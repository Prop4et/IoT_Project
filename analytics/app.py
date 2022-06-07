from flask import Flask, jsonify, render_template, request
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
import time 
import json

app = Flask(__name__)

fd =  open('../server/influxconfig.json', 'r')
config = json.load(fd)
client =  InfluxDBClient(url='http://'+config["remotehost"]+':'+config["port"], token=config["token"], org=config["org"], debug=False)
fd.close()

write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()  

#dunno if i should somehow parametrize the sensor on which i'm doing the prediction tbh, but i think so

query_temp = 'from(bucket:"temp")' \
        ' |> range(start:-6h)'\
        ' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r._value > -300)'

query_hum = 'from(bucket:"hum")' \
        ' |> range(start:-6h)'\
        ' |> filter(fn: (r) => r._measurement == "val" and r._field == "value" and r._value > -1)'

query_smoke = 'from(bucket:"smoke")' \
        ' |> range(start:-6h)'\
        ' |> filter(fn: (r) => r._measurement == "val" and r._field == "value")'

result_temp = query_api.query_data_frame(query_temp)

df = result_temp.drop(columns=['result', 'table', '_start', '_stop', '_field', '_measurement'])
df_temp = df.copy()
df_temp = df_temp.loc[df_temp['sensor'] == '0']
df_temp = df_temp.drop(columns=['lat', 'lon', 'sensor'])
df_temp = df_temp.rename(columns = {'_time': 'Time', '_value': 'Hum'})
df_temp['Time'] = df_temp['Time'].dt.strftime('%d-%m-%Y %H:%M:%S')



history = [x for x in df_temp]
predictions = list()
for t in range(len(df_temp.index),(len(df.index)+10)):

    model = ARIMA(history, order=(1,1,1)) #d is the number of time that the raw values are differentiated
    model_fit = model.fit()
    output = model_fit.forecast()
    yest = output[0]
    predictions.append(yest)
timestamps= [x for x in range(len(df.index),(len(df.index)+10))]

forecast = pd.DataFrame(zip(timestamps,predictions),columns =['time', 'val'])
forecast['measurement'] = "views"

cp = forecast.copy()

lines = [str(cp["measurement"][d]) 
        + ",type=forecast" 
        + " " 
        + "yhat=" + str(cp["val"][d]) 
        + " " + str(int(time.mktime(cp['time'][d].timetuple()))) + "000000000" for d in range(len(cp))]




#writing data predicted back on influx 
_write_client = client.write_api(write_options=WriteOptions(batch_size=1000, 
                                                            flush_interval=10_000,
                                                            jitter_interval=2_000,
                                                            retry_interval=5_000))

_write_client.write(bucket, org, lines)
    # show the post with the given id, the id is an integer
#return f'Forcasted for {predLen} timestamps'
#@app.route("/")
#def index():
# return render_template('index.html')

if __name__ == '__main__':
    app.run()