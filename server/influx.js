const { InfluxDB } = require('@influxdata/influxdb-client')
const { Point } = require('@influxdata/influxdb-client')
const moment = require('moment')
//TODO: test influx integration with a stable internet
class InfluxClient {
    constructor(host, port, token, org) {
        this.client = new InfluxDB({ url: 'http://' + host + ":" + port, token: token })
        this.host = host
        this.port = port
        this.token = token
        this.org = org
        console.log("Influx connected")
    }

    writeOW(lat, lon, bucket, data, type){
        if(bucket == undefined || bucket == null)   return;
        
        const writeApi = this.client.getWriteApi(this.org, bucket, 's');
        writeApi.useDefaultTags({bucket: type, lat: lat, lon: lon});//type is temp or hum
        //compute end of the day
        let today = moment().format('YYYY-MM-DD');
        let endDay = new Date(today+'T23:59:59')
        //create points
        var point = new Point('val');
        point = point.floatField('value', data);
        writeApi.writePoint(point);

        var futurePoint = new Point('val')
        futurePoint.timestamp(endDay.getTime() / 1000)
        futurePoint = futurePoint.floatField('value', data);
        writeApi.writePoint(futurePoint);
        writeApi
            .close()
            .then(() => {
                console.log('Openweather API wrote: ' + type +' <- '+data);
            })
            .catch(e => {
                console.log('Influx Error in writing',e);
            })

    }

    writeDB(id, lat, lon, bucket, data){
        if(bucket == undefined || bucket == null) return;
        //create a write API
        const writeApi = this.client.getWriteApi(this.org, bucket);
        //give the tag to data (sensor id)
        writeApi.useDefaultTags({sensor: id.toString(), lat: lat, lon: lon});
        var point = new Point('val');

        if(bucket == 'aqi')
            point = point.intField('value', data);
        else
            point = point.floatField('value', data);
        writeApi.writePoint(point);

        writeApi
            .close()
            .then(() => {
                console.log('...Influx wrote for sensor ' + id + ': ' + bucket +' <- '+data);
            })
            .catch(e => {
                console.log('Influx Error in writing',e);
            })
    }

    quryDB(query){
        const queryApi = this.client.getQueryApi(this.org);

        queryApi.queryRows(query, {
            next(row, tableMeta){
                const o = tableMeta.toObject(row);
                console.log(`${o._time} ${o._measurement}: ${o._field} = ${o._value}`);
            },
            error(e) {
                console.log('Influx Query Error: ' + e);
            },
            complete() {
                console.log('Influx: finished success');
            }
        })
    }
}

module.exports = {
    InfluxClient,
}