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


if __name__ == '__main__':
    app.run()