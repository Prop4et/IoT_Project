## SPECS
- [x] Smart device
    - [x] ESP32
    - [x] DHT22
    - [x] MQ2
    - [x] MQ135

- [x] Data proxy
    - [x] MQTT 
    - [x] CoAP
    - [x] Ping
    - [x] Runtime change
    - [x] InfluxDB write integration
- [ ] Data mgmt system
    - [x] InlfuxDB query 
    - [x] Grafana Dashboard for each data flow
    - [x] Grafana alert for AQI >= 1
- [ ] Data Analytics

### Additional Components
- [ ] Outdoor temperature value from open API Weather
    - [ ] Store in influx 
    - [ ] Visualization through Grafana

- [ ] Telegram bot <-- NEXT

- [ ] Web dashboard
    - [ ] Monitor multiple air quality stations at the same time
    - [ ] Register new device
    - [x] Config parameters
    - [ ] Visualize position on a map
    - [ ] Access data through grafana
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
