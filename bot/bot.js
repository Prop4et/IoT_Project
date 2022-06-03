const { InfluxDB } = require('@influxdata/influxdb-client')
const { Telegraf } = require('telegraf')

const influxConfig = require('../server/influxconfig')
const botConfig = require('./botconfig')

client  = new InfluxDB({ url: 'http://' + influxConfig.host + ":" + influxConfig.port, token: influxConfig.token })

bot = new Telegraf(botConfig.token)
bot.start((context) => {
    console.log("InfluxDB: Alert Bot started")
    context.reply("Measures:\n-\
    /temp <sensor-id>\n-\
    /hum <sensor-id>\n-\
    /smoke <sensor-id>\n-\
    /rss <sensor-id>\n-\
    /aqi <sensor-id>\n-\
    /co <sensor-id>\n-\
    /co2 <sensor-id>\n-\
    /nh4 <sensor-id>\n-\
    /al <sensor-id>\n-\
    /ac <sensor-id>\n-\
    /to <sensor-id>\n")
})


for (const [key, value] of Object.entries(influxConfig.buckets)) {
    console.log('Creation of command /'+ key + ' to query on bucket ' + value)
    bot.command(key, context=>{
        let textBot = context.update.message
        let sensorId = textBot.text.split(' ')[1]
        if(sensorId == null || sensorId == undefined || sensorId == " "){
            context.reply('Need to specify a sensor sensorId id!')
        } else {
            let bucket = value
            let query = `
            from(bucket: "${bucket}") 
            |> range(start: -10m)
            |> filter(fn: (r) => r._measurement == "val")
            |> filter(fn: (r) => r._field == "value")
            |> filter(fn: (r) => r.sensor == string(v: "${sensorId}"))
            |> movingAverage(n: 5)
            |> yield(name: "mean")
            `
            const queryApi = client.getQueryApi(influxConfig.org)
            var rowResult;
            queryApi.queryRows(query, {
                next(row, tableMeta) {
                    rowResult = tableMeta.toObject(row)._value
                },
                error(e) {
                    console.log(e);
                    context.reply("Sensor is offline, try later!")
                },
                complete() {
                    if(rowResult == undefined || rowResult == null){
                        context.reply("Sensor is offline, try later!")
                    } else {
                        console.log('Writing bot for /' + value + " command");
                        switch(value){
                            case "temp": context.reply("The current mean temperature is " + Math.round(rowResult, 2) + "° on sensor " + sensorId); break;
                            case "hum" : context.reply("The current mean humidity percentage is " + Math.round(rowResult, 2) + "% on sensor " + sensorId); break;
                            case "rss": context.reply("The current mean RSS is " + Math.round(rowResult, 2) + " dBm on sensor " + sensorId); break;
                            case "aqi": context.reply("The current mean AQI value is " + Math.round(rowResult, 2) + " on sensor " + sensorId); break;
                            case "smoke": context.reply("The current mean smoke value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "co": context.reply("The current mean co value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "co2": context.reply("The current mean co2 value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "to": context.reply("The current mean toluen value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "nh4": context.reply("The current mean nh4 value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "ac": context.reply("The current mean acetone value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;
                            case "al": context.reply("The current mean alcohol value is " + Math.round(rowResult, 2) + " ppm on sensor " + sensorId); break;

                            default: break;
                        }
                        
                    }
                },
            })
        }
    })

}
console.log('Status: Success')
console.log('Launching bot...')
bot.launch()
console.log('@Prop4etHomeSensor_bot on Telegram.')