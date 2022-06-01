const { InfluxDB } = require('@influxdata/influxdb-client')
const { Point } = require('@influxdata/influxdb-client')
const config = require('./influxconfig')
class InfluxClient {
    constructor(host, port, token, org) {
        this.client = new InfluxDB({ url: 'http://' + host + ":" + port, token: token })
        this.host = host
        this.port = port
        this.token = token
        this.org = org
    }

    writeDB(id, lat, lon, bucket, data){
        //create a write API
        const writeApi = this.client.getWriteApi(this.org, bucket);
        //give the tag to data (sensor id)
        writeApi.useDefaultTags({sensor: id, gps: (lat, lon)});
        const point = new Point('val');

        if(bucket == undefined || bucket == null) return;

        if(bucket == 'aqi')
            point = point.intField('value', data);
        else
            point = point.floatField('value', data);
        writeApi.writePoint(point);

        writeApi
            .close()
            .then(() => {
                console.log('...Influx wrote for sensor: ' + id + ': ' + bucket +'<-'+data);
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

// main()
function demo(){
    const token = config.token
    const org = config.org
    const host = config.host
    const port = config.port
    const buckets = config.buckets

    const clientId = '3030' //dunno if needed, in case i can just save the ids in the db too

    console.log('Starting the influx connection')

    var influxClient = new InfluxClient(host, port, token, org);

}

demo();

module.exports = {
    InfluxClient,
}