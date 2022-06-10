## SPECS
- [x] Smart device
    - [x] ESP32
    - [x] DHT22
    - [x] MQ2
    - [x] MQ135

- [x] Data proxy
    - [x] MQTT 
    - [x] CoAP -> TODO: fix pending requests when changing algorithm
    - [x] Ping
    - [x] Runtime change
    - [x] InfluxDB write integration
- [x] Data mgmt system
    - [x] InlfuxDB query 
    - [x] Grafana Dashboard for each data flow
    - [x] Grafana alert for AQI >= 1
- [x] Data Analytics

### Additional Components
- [x] Outdoor temperature value from open API Weather
    - [x] Store in influx 
    - [x] Visualization through Grafana

- [x] Telegram bot

- [x] Web dashboard
    - [x] Monitor multiple air quality stations at the same time
    - [x] Register new device
    - [x] Config parameters
    - [x] Visualize position on a map
    - [x] Access data through grafana
## CONTROLLER AND HARDWARE 
- ESP32 dev module
- MQ2 gas and smoke sensor
- MQ135 Co2, alchool, Toulene, NH4, CO and Aceton sensor
- DHT22 humidity and temperature sensor
- 2x 1K Ohm resistors
- Jump wires
- Breadboard
- VSCode IDE

Photo will be added here 
