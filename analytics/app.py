from flask import Flask, jsonify, render_template, request
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.domain.write_precision import WritePrecision
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from datetime import timedelta
import json
from interval import Interval


app = Flask(__name__)

ids = []
fd =  open('../server/influxconfig.json', 'r')
config = json.load(fd)
client =  InfluxDBClient(url='http://'+config["remotehost"]+':'+config["port"], token=config["token"], org=config["org"], debug=False)
fd.close()

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()  

@app.route('/newId/<int:id>')
def newId(id):
    print('new sensor added with id', id)
    ids.append(id) #append is atomic

def create_df(query):
	result_temp = query_api.query_data_frame(query)
	if result_temp.empty:
		print('Query result is none')
		return None
	#get the dataframe and clean it up
	df_clean = result_temp.copy()
	df_clean = df_clean.drop(columns=['result', 'table', '_start', '_stop', '_field', '_measurement', 'lat', 'lon', 'sensor'])
	df_clean = df_clean.rename(columns = {'_time': 'Time', '_value': 'v'})
	df_clean['Time'] = pd.to_datetime(df_clean['Time'].dt.strftime('%Y-%m-%d %H:%M:%S'))
	return df_clean

#QUERY HANDLING
def build_query(sensor_id, bucket):
    return 'from(bucket:"'+bucket+'")' \
			' |> range(start: -2h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r.sensor == ''"'+str(sensor_id)+'"'')'

def writeDB(predictions, last_time, sensor_id, bucket):
	i = 0
	print('last time: ', last_time)
	for p in predictions:
    	#correct
		t = (last_time+timedelta(seconds=i)).strftime('%Y-%m-%dT%H:%M:%S')
		#write the new point
		pt = Point("val").tag('sensor', sensor_id).field("bucket", bucket).field("value", p).time(t, write_precision=WritePrecision.S)
		write_api.write(bucket="predictions", org="IoT", record=pt)
		i += 1


def train_and_predict(df, window):
    #i mean it sucks, but window something like 300
	history = [x for x in df['v']]
	model = ARIMA(history, order=(1,1,1))
	fitted = model.fit()
	return fitted.predict(start=len(df), end=len(df)+window-1)

def prediction(bucket, sensorIds):
	for id in sensorIds:
		print('id', id)
		query = build_query(id, bucket)
		print('query', query)
		df = create_df(query)
		if df is not None:
			predictions = train_and_predict(df, 300)
			writeDB(predictions, df.iloc[len(df)-1]['Time'], id, bucket)


#need to create three of them to make it parallel
intervalUpdateT = Interval(60.0, prediction, ["temp", ids]) #retrain each model every minute
intervalUpdateH = Interval(60.0, prediction, ["hum", ids]) #retrain each model every minute
intervalUpdateS = Interval(60.0, prediction, ["smoke", ids]) #retrain each model every minute

intervalUpdateT.run()
intervalUpdateH.run()
intervalUpdateS.run()
