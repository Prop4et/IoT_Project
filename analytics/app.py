from flask import Flask, jsonify, render_template, request
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.domain.write_precision import WritePrecision
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from datetime import timedelta
import json

app = Flask(__name__)

fd =  open('../server/influxconfig.json', 'r')
config = json.load(fd)
client =  InfluxDBClient(url='http://'+config["remotehost"]+':'+config["port"], token=config["token"], org=config["org"], debug=False)
fd.close()

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()  

buckets = ['temp', 'hum', 'smoke']

def create_df(query):
	result_temp = query_api.query_data_frame(query)
	df_clean = result_temp.copy()
	df_clean = df_clean.drop(columns=['result', 'table', '_start', '_stop', '_field', '_measurement', 'lat', 'lon', 'sensor'])
	df_clean = df_clean.rename(columns = {'_time': 'Time', '_value': 'v'})
	#CHECK THIS
	df_clean['Time'] = df_clean['Time'].dt.strftime('%d-%m-%Y %H:%M:%S')
	print(df_clean['Time'])
	return df_clean

#time(v: "2016-06-13T17:43:50.1004002Z")		
#QUERY HANDLING
def build_query(sensor_id, bucket):
    return 'from(bucket:"'+bucket+'")' \
			' |> range(start: -6h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r._value > -300 and r.sensor == ''"'+str(sensor_id)+'"'')'

#route to call for the training, i'd like to retrain the model daily with a span of data of 6 hours from 15 to 21, it's slow tho, i need to investigate for a good interval
#and stop i think

def get_prediction(df, window):
	history = [x for x in df['v']]
	predictions = list()
	for t in range(len(df), len(df)+window):
		model = ARIMA(history, order=(1,1,1)) #parameters obtained from the analysis of the notebook
		model_fit = model.fit()
		output = model_fit.forecast()
		yest = output[0]
		predictions.append(yest)
		#add the value just prodced to the history, to help produce the new one
		history.append(yest)
	return predictions

def writeDB(predictions, last_time, sensor_id):
	i = 0
	print('last time: ', last_time)
	for p in predictions:
		#this one needs to be printed
		t = (last_time+timedelta(seconds=i)).strftime('%Y-%m-%dT%H:%M:%S')
		print(t)
		pt = Point("val").tag('sensor', sensor_id).field("value", p).time(t, write_precision=WritePrecision.S)
		write_api.write(bucket="predictions", org="IoT", record=pt)
		i += 1


#route to call for the predictions for each sensor for the given time window
#the time window for the prediction is the same foreach bucket
@app.route('/predict/<int:sensor_id>/<int:time_window>')
def predict(sensor_id, time_window):
	if(time_window > 20):
		return f'High time window'
	for bucket in buckets:
		query = build_query(sensor_id, bucket)
		df = create_df(query)
		predictions = get_prediction(df, time_window)
		writeDB(predictions, df.iloc[len(df)-1]['time'], sensor_id)
	return f'Predicted for sensor {sensor_id} on a time window of {time_window}'
	
		

@app.route("/")
def index():
	#here you retrain the model
	return '<b>hello world</b>'


if __name__ == '__main__':
    app.run()