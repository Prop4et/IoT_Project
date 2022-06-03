const { InfluxDB } = require('@influxdata/influxdb-client')
const { Point } = require('@influxdata/influxdb-client')
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

    writeDB(id, lat, lon, bucket, data){
        //create a write API
        const writeApi = this.client.getWriteApi(this.org, bucket);
        //give the tag to data (sensor id)
        writeApi.useDefaultTags({sensor: id.toString(), lat: lat, lon: lon});
        var point = new Point('val');

        if(bucket == undefined || bucket == null) return;

        if(bucket == 'aqi')
            point = point.intField('value', data);
        else
            point = point.floatField('value', data);
        writeApi.writePoint(point);

        writeApi
            .close()
            .then(() => {
                console.log('...Influx wrote for sensor ' + id + ': ' + bucket +'<-'+data);
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