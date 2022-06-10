const { InfluxDB } = require('@influxdata/influxdb-client')
const { Telegraf } = require('telegraf')

const influxConfig = require('../server/config').influx
const botConfig = require('./botconfig')

client  = new InfluxDB({ url: 'http://' + influxConfig.host + ":" + influxConfig.port, token: influxConfig.token })
var updateIntervalId = {};
var alertIntervalId = {};
bot = new Telegraf(botConfig.token)
bot.start((context) => {
    console.log("InfluxDB: Bot started")
    var msg = "Measures:\n\t-\
        /temp <sensor-id>\n\t-\
        /hum <sensor-id>\n\t-\
        /smoke <sensor-id>\n\t-\
        /rss <sensor-id>\n\t-\
        /aqi <sensor-id>\n\t-\
        /co <sensor-id>\n\t-\
        /co2 <sensor-id>\n\t-\
        /nh4 <sensor-id>\n\t-\
        /al <sensor-id>\n\t-\
        /ac <sensor-id>\n\t-\
        /to <sensor-id>\n Activate periodic updates:\n\t-\
        /pon <sensor-id> <time[s]>\n Stop periodic updates:\n\t-\
        /poff <sensor-id>\n Activate alerts on AQI:\n\t-\
        /aon <sensor-id>\n\ Stop alerts on AQI:\n\t-\
        /aoff <sensor-id>";
        let sensorQuery = `
        from(bucket: "temp")
        |> range(start: -1m)
        |> group(columns: ["sensor"])
        |> distinct(column: "sensor")`
        const queryApi = client.getQueryApi(influxConfig.org)
        var rowResult;
        queryApi.queryRows(sensorQuery, {
            next(row, tableMeta) {
                rowResult = tableMeta.toObject(row)._value
            },
            error(e) {
                console.log(e);
                context.reply("Something went wrong :/")
            },
            complete() {
                if(rowResult == undefined || rowResult == null){
                    msg += "\n No sensors connected for the past minute";
                    context.reply(msg);
                } else {
                    msg += "\n Sensor IDs seen in the past minute: ";
                    for(i in rowResult)
                        msg += "\n >          "+ rowResult[i];
                    context.reply(msg);
                }
            },
        })
})


for (const [key, value] of Object.entries(influxConfig.buckets)) {
    console.log('Creation of command /'+ key + ' to query on bucket ' + value)
    bot.command(key, context=>{
        let textBot = context.update.message
        let sensorId = textBot.text.split(' ')[1]
        if(sensorId == null || sensorId == undefined || sensorId == " "){
            context.reply('Need to specify a sensor id!')
        } else {
            let bucket = value
            let query = `
            from(bucket: "${bucket}") 
            |> range(start: -1h)
            |> filter(fn: (r) => r._measurement == "val")
            |> filter(fn: (r) => r._field == "value")
            |> filter(fn: (r) => r.sensor == string(v: "${sensorId}"))
            |> movingAverage(n: 5)
            |> yield(name: "mean")`
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
                            case "temp": context.reply("The current mean temperature is " + rowResult.toFixed(2) + "° on sensor " + sensorId); break;
                            case "hum" : context.reply("The current mean humidity percentage is " + rowResult.toFixed(2) + "% on sensor " + sensorId); break;
                            case "rss": context.reply("The current mean RSS is " + rowResult.toFixed(2) + " dBm on sensor " + sensorId); break;
                            case "aqi": context.reply("The current mean AQI value is " + rowResult.toFixed(2) + " on sensor " + sensorId); break;
                            case "smoke": context.reply("The current mean smoke value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "co": context.reply("The current mean co value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "co2": context.reply("The current mean co2 value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "to": context.reply("The current mean toluen value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "nh4": context.reply("The current mean nh4 value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "ac": context.reply("The current mean acetone value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;
                            case "al": context.reply("The current mean alcohol value is " + rowResult.toFixed(2) + " ppm on sensor " + sensorId); break;

                            default: break;
                        }
                        
                    }
                },
            })
        }
    })

}

var msg = "";

bot.command('pon', context =>{
    let textBot = context.update.message;
    let paramsArr = textBot.text.split(' ');
    let sensorId = paramsArr[1];
    let time = paramsArr[2];
    if(sensorId == null || sensorId == undefined || sensorId == " "){
        context.reply('Need to specify a sensor id!');
        return;
    }
    if(time == null || time == undefined || time == " " || isNaN(time)){
        context.reply('Need to specify a a valid time!');
        return;
    }else
        time = parseInt(time);
    updateIntervalId[sensorId] = setInterval( () => {
        var i = 0;
        var msg = "";
        for (const [key, value] of Object.entries(influxConfig.buckets)) {
            let bucket = value
            let query = `
                from(bucket: "${bucket}") 
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "val")
                |> filter(fn: (r) => r._field == "value")
                |> filter(fn: (r) => r.sensor == string(v: "${sensorId}"))
                |> movingAverage(n: 5)
                |> yield(name: "mean")`;
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
                        msg += "mean value for " + value + " is " + rowResult.toFixed(2) + "\n";
                    }
                    i++;
                    if(i == Object.keys(influxConfig.buckets).length){
                        context.reply(msg);
                    }
                },
            })
            
        }
    },time*1000);
    context.reply("Started periodic updates for id " + sensorId);
})

bot.command('aon', context =>{
    let textBot = context.update.message;
    let paramsArr = textBot.text.split(' ');
    let sensorId = paramsArr[1];
    if(sensorId == null || sensorId == undefined || sensorId == " "){
        context.reply('Need to specify a sensor id!');
        return;
    }

    var prevAlert = false;
    var alert = false;//0 is fine, 1 is alert
    alertIntervalId[sensorId] = setInterval( () => { //query the aqi value every 5 seconds, if it changes from 0 to something else or viceversa send the alert message
        let now = new Date(Date.now());
        let query = `
            from(bucket: "aqi") 
            |> range(start: -1m)
            |> filter(fn: (r) => r._measurement == "val")
            |> filter(fn: (r) => r._field == "value")
            |> filter(fn: (r) => r.sensor == string(v: "${sensorId}"))
            |> aggregateWindow(every: 20s, fn: last)`;
        const queryApi = client.getQueryApi(influxConfig.org)
        var rowResult = [];
        queryApi.queryRows(query, {
            next(table, tableMeta) {
                rowObj = tableMeta.toObject(table);
                rowResult.push(rowObj._value);
            },
            error(e) {
                console.log(e);
                context.reply("Sensor is offline, try later!")
            },
            complete() {
                if(rowResult == undefined || rowResult == null || rowResult.length === 0){
                    context.reply("Sensor is offline, try later!")
                } else {
                    var balance = 0;
                    var nullCount = 0;
                    for(i in rowResult){
                        if(rowResult[i] == null)
                            nullCount++;
                        if(rowResult[i] > 0)
                            balance--;
                        if(rowResult[i] === 0)
                            balance++;
                    }
                    if(nullCount === rowResult.length){
                        context.reply("Sensor is offline, check it");
                        return;
                    }
                    
                    if(balance > 0)
                        alert = false;
                    if(balance < 0)
                        alert = true;
                    if(alert != prevAlert){
                        if(alert)
                            context.reply("ALERT AQI \nAQI levels are not safe!");
                        if(!alert)
                            context.reply('AQI OK \nAQI levels are back to normal');
                        prevAlert = alert;
                    }
                }
            },
        })
    },30000);
    context.reply("Started periodic alert for sensor " + sensorId);
})


bot.command('poff', context =>{
    let textBot = context.update.message;
    let sensorId = textBot.text.split(' ')[1];
    if(sensorId == null || sensorId == undefined || sensorId == " "){
        context.reply('Need to specify a sensor id!');
        return;
    }
    if(updateIntervalId[sensorId]){
        clearInterval(updateIntervalId[sensorId]);
        updateIntervalId[sensorId] = null;
        context.reply('Periodic updates removed for id ' + sensorId);
    }else
        context.reply('No active timer for id ' + sensorId);
})

bot.command('aoff', context => {
    let textBot = context.update.message;
    let sensorId = textBot.text.split(' ')[1];
    if(sensorId == null || sensorId == undefined || sensorId == " "){
        context.reply('Need to specify a sensor Id!');
        return;
    }

    if(alertIntervalId[sensorId]){
        clearInterval(alertIntervalId[sensorId]);
        alertIntervalId[sensorId] = null;
        context.reply('Periodic alerts removed for id ' + sensorId);
    }else
        context.reply('No active timer for id ' + sensorId);

})
console.log('Status: Success')
console.log('Launching bot...')
bot.launch()
console.log('@Prop4etHomeSensor_bot on Telegram.')