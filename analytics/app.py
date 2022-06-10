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
buckets = ['temp', 'hum', 'smoke']
intervalsId = {}

fd =  open('../server/config.json', 'r')
config = json.load(fd)
client =  InfluxDBClient(url='http://'+config["influx"]["remotehost"]+':'+config["influx"]["port"], token=config["influx"]["token"], org=config["influx"]["org"], debug=False)
fd.close()

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()  

@app.route('/newId/<int:id>', methods = ['POST'])
def newId(id):
	print('new sensor added with id', id)
	for i in range(0, len(ids)):
		if ids[i] == id:
			return f'[PRED] already in id '+str(id)
	ids.append(id) #append is atomic
	return f'[PRED] new id added '+str(id)

@app.route('/removeId/<int:id>', methods = ['POST'])
def removeId(id):
	print('sensor disconnected', id)
	for i in range(0, len(ids)):
		if ids[i] == id:
			ids.pop(i)
	return f'[PRED] removed id '+str(id)

def create_df(query):
	result_temp = query_api.query_data_frame(query)
	if result_temp.empty:
		print('Query result is none')
		return None
	#get the dataframe and clean it up
	df_clean = result_temp.copy()
	df_clean = df_clean.drop(columns=['result', 'table', '_start', '_stop', '_field', '_measurement', 'lat', 'lon', 'sensor'])
	df_clean = df_clean.rename(columns = {'_time': 'Time', '_value': 'y'})
	df_clean['Time'] = pd.to_datetime(df_clean['Time'].dt.strftime('%Y-%m-%d %H:%M:%S'))
	return df_clean

#QUERY HANDLING
def build_query(sensor_id, bucket):
    return 'from(bucket:"'+bucket+'")' \
			' |> range(start: -8h)'\
			' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r.sensor == ''"'+str(sensor_id)+'"'')'

def writeDB(predictions, last_time, sensor_id, bucket):
	i = 0
	for p in predictions:
    	#correct
		t = (last_time+timedelta(seconds=i)).strftime('%Y-%m-%dT%H:%M:%S')
		#write the new point
		pt = Point("val").tag('sensor', sensor_id).tag("bucket", bucket).field("value", p).time(t, write_precision=WritePrecision.S)
		write_api.write(bucket="predictions", org="IoT", record=pt)
		i += 1

def train_and_predict(df, window):
	history = [x for x in df['y']]
	model = ARIMA(history, order=(1,1,1))
	fitted = model.fit()
	return fitted.forecast(window)

def prediction(bucket, window, sensorId):
	print('prediction for bucket ' + bucket + ' on sensor ' + str(sensorId))
	query = build_query(sensorId, bucket)
	df = create_df(query)
	if df is not None:
		predictions = train_and_predict(df, window)
		writeDB(predictions, df.iloc[len(df)-1]['Time'], sensorId, bucket)

@app.route('/predict/<int:sensorId>/<int:window>', methods=['POST'])
def predict(sensorId, window):
    #no sensor found with that id
	if sensorId not in ids:
		return f'id ' + str(sensorId) + ' not registered'
	if sensorId in intervalsId:
		print('stopping previous predictions')
		for bucket in buckets:
			intervalsId[sensorId][bucket].stop()
			prediction(bucket, window, sensorId)
	#there are no models for that id
	if sensorId not in intervalsId:
		intervalsId[sensorId] = {}
	for bucket in buckets:
		if window < 15:
			window = 15
		intervalsId[sensorId][bucket] = Interval(window-15, prediction, [bucket, window, sensorId])
		intervalsId[sensorId][bucket].start()
	return f'[PRED] started prediction for id ' + str(sensorId)