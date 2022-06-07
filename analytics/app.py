from flask import Flask, jsonify, render_template, request
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_squared_error
import time 
import os
import json
import math

app = Flask(__name__)

fd =  open('../server/influxconfig.json', 'r')
config = json.load(fd)
client =  InfluxDBClient(url='http://'+config["remotehost"]+':'+config["port"], token=config["token"], org=config["org"], debug=False)
fd.close()

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()  

buckets = ['temp', 'hum', 'smoke']
old_rmse = {'temp': 100, 'hum': 100, 'smoke': 100}
#dunno if i should somehow parametrize the sensor on which i'm doing the prediction tbh, but i think so

def create_tmp_df(query):
	result_temp = query_api.query_data_frame(query)
	df = result_temp.drop(columns=['result', 'table', '_start', '_stop', '_field', '_measurement'])
	df_clean = df.copy()
	df_clean = df_clean.drop(columns=['lat', 'lon', 'sensor'])
	df_clean = df_clean.rename(columns = {'_time': 'Time', '_value': 'v'})
	df_clean['Time'] = df_clean['Time'].dt.strftime('%d-%m-%Y %H:%M:%S')
	return df_clean

def split_test(df):
	l = len(df.values)
	splitpoint = int(l*0.80)
	train = df['v'][:splitpoint]
	test = df['v'][splitpoint:]
	return [train, test]

def train_model(train, test, key):
	history = [x for x in train]
	predictions = list()
	for t in test.index:
		model = ARIMA(history, order=(1,1,1)) 
		model_fit = model.fit()
		output = model_fit.forecast()
		yest = output[0]
		predictions.append(yest)
		obs= test[t]
		history.append(obs)
	rmse = math.sqrt(mean_squared_error(test, predictions))
	if rmse < old_rmse[key]:
		old_rmse[key] = rmse
		return True
	else:
		return False
    	

def build_temp_query(sensor_id):
    return 'from(bucket:"temp")' \
			' |> range(start:-8h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r._value > -300 and r.sensor == ''"'+str(sensor_id)+'"'')'
def build_hum_query(sensor_id):
	return 'from(bucket:"hum")' \
			' |> range(start:-6h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r._value > -1 and r.sensor == ''"'+str(sensor_id)+'"'')'
def build_smoke_query(sensor_id):
	return 'from(bucket:"smoke")' \
			' |> range(start:-6h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r.sensor == ''"'+str(sensor_id)+'"'')'

#route to call for the prediction, i'd like to retrain the model daily with a span of data of 6 hours from 15 to 21
@app.route("/train/<int:sensor_id>")
def train(sensor_id):
	queries = {'temp': build_temp_query(sensor_id), 'hum': build_hum_query(sensor_id), 'smoke': build_smoke_query(sensor_id)}
	for b in buckets:
		df_temp = create_tmp_df(queries[b])
		train, test = split_test(df_temp)
		if(train_model(train, test, b)):
			df_temp.to_csv('./static/'+b+'.csv')
	return f'Trained for sensor {sensor_id}'
	

	

#route to call for the predictions for each sensor for the given time window
#the time window for the prediction is the same foreach bucket
@app.route('/predict/<int:sensor_id>/<int:time_window>')
def predict(sensor_id, time_window):
	for b in buckets:
		with open('./static/'+b+'.csv', 'r') as fd:
			df = pd.read_csv(fd)
			print(df)
	return f'Predicted for sensor {sensor_id} on a time window of {time_window}'
	
		

@app.route("/")
def index():
	#here you retrain the model
	return '<b>hello world</b>'


if __name__ == '__main__':
    app.run()