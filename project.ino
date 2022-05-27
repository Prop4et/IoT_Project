#include <WiFi.h>
#include <WiFiUdp.h>
#include <DHT.h>
#include <MQUnifiedsensor.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <coap-simple.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

//*********************************DHT HW PARAMS ***************************************
#define DHTPIN 4
#define DHTTYPE DHT22

//*********************************MQ HW PARAMS******************************************
#define         BOARD                   ("ESP-32") 
#define         PIN_MQ2                 (35)
#define         PIN_MQ135               (34)

//***********************Software Related Macros*****************************************
#define         Type135                 ("MQ-135") 
#define         Type2                   ("MQ-2")
#define         Voltage_Resolution      (3.3) // 3V3, 5 is high
#define         ADC_Bit_Resolution      (12) 
#define         RatioMQ135CleanAir      (3.6) 
#define         RatioMQ2CleanAir        (9.83)
#define         WINDOW                  (5)

//*********************************SETTINGS**********************************************
const char *id = "3030";
const float lat = 44.501;
const float lon = 11.350;
int SAMPLE_FREQ = 10000;
float MIN_GAS_VALUE = 0;
float MAX_GAS_VALUE = 5000;
int protocol = 1; //1 is MQTT, 2 is COAP
int AQI = 2; //0 if avg > MAX_GAS_VALUE, 1 if MIN_GAS_VALUE < avg < MAX_GAS_VALUE, 2 otherwise
int n_sample = 0;
int shifting_index = 0;
float array_avg[WINDOW] = {-1, -1, -1, -1, -1};//-1 is not a valid argument for the voltage 
const int doc_info_capacity = JSON_OBJECT_SIZE(3) + JSON_OBJECT_SIZE(2);
const int doc_temp_hum_capacity = JSON_OBJECT_SIZE(2);
const int doc_MQ2_capacity = JSON_OBJECT_SIZE(3);
const int doc_PPM_capacity = JSON_OBJECT_SIZE(6);
StaticJsonDocument<doc_info_capacity> info_doc;
StaticJsonDocument<doc_temp_hum_capacity> temp_hum_doc;
StaticJsonDocument<doc_MQ2_capacity> MQ2_doc;
StaticJsonDocument<doc_PPM_capacity> PPM_doc;
char buffer_info[sizeof(info_doc)];
char buffer_temp_hum[sizeof(temp_hum_doc)];
char buffer_MQ2[sizeof(MQ2_doc)]; 
char buffer_PPM[sizeof(PPM_doc)];
//*********************************SENSORS***********************************************
//dht sensor define 
DHT dht(DHTPIN, DHTTYPE);
//MQ sensor define 
MQUnifiedsensor MQ135(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ135, Type135);
MQUnifiedsensor MQ2(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ2, Type2);

//*********************************WiFi***************************************************
char ssid[] = "SbalziOrmonaliA2.4G";
char pwd[] = "Lovegang126";
IPAddress dev_ip(192, 168, 1, 229);
/*char ssid[] = "POCOF2PRO";
char pwd[] = "macciocca";*/
float RSS = 0;
int status = WL_IDLE_STATUS;

//*********************************MQTT Broker********************************************
const char *mqtt_broker = "18.191.129.230";
const int mqtt_port = 1883;
const char *mqtt_username = "Prop4et";
const char *mqtt_password = "Progetto_IoT";
const char *topic = "sensor/";
//temp_hum -> temperature and humidity
//info -> RSS, id, gps
//MQ2 -> AQI, smoke, avg
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton
//add 3030
const char *info_topic = "sensor/3030/info";
const char *temp_hum_topic = "sensor/3030/temp_hum/";
const char *MQ2_topic = "sensor/3030/MQ2";
const char *PPM_topic = "sensor/3030/PPM";
const char *topic_update = "sensor/update/3030";
//**********************************MQTT vars**********************************************
WiFiClient client;
PubSubClient mqttClient(client); //mqttClient for the mqtt publish subscribe
//**********************************MQTT functions*****************************************
//callback when receiving mqtt response
void callback_response_mqtt(char *topic, byte *payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    
    char p[length];
	memcpy(p, payload, length);
    p[length] = '\0';
    DeserializationError error = deserializeJson(doc, (const char*)p, length);
    if(error){
        Serial.print("Deserialization failed: "); 
        Serial.println(error.f_str());
    } 
    SAMPLE_FREQ = doc["sampleFrequency"];
    MAX_GAS_VALUE = doc["maxGas"];
    MIN_GAS_VALUE = doc["minGas"];
    protocol = doc["proto"];

    Serial.println("Update received");
    Serial.print("SF: "); Serial.print(SAMPLE_FREQ); Serial.print("\t maxGas: "); Serial.print(MAX_GAS_VALUE); Serial.print("\t minGas:"); Serial.print(MIN_GAS_VALUE); Serial.print("\tprotocol: "); Serial.println(protocol);
    Serial.println("-----------------------");
}
//function for connecting to the mqtt mqttClient
void mqtt_connect(){
    mqttClient.setServer(mqtt_broker, mqtt_port);
    mqttClient.setCallback(callback_response_mqtt); // setup the callback for the mqttClient connection (MQTT) 
    while (!mqttClient.connected()) {
        String client_id = "esp32-mqttClient-";
        client_id += String(WiFi.macAddress());
        Serial.printf("Trying to connect to the mqtt broker ... ");
        if (mqttClient.connect(client_id.c_str(), mqtt_username, mqtt_password)) {
            mqttClient.subscribe(topic_update);
            Serial.println("Connected");
        }else{
            // connection error handler
            Serial.print("Connection failed with state ");
            Serial.print(mqttClient.state());
            delay(2000);
        }
    }
}
//********************************COAP vars***********************************************
WiFiUDP coapServer; 
Coap coap(coapServer); //server coap
//********************************COAP functions******************************************
void callback_coap_info(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Coap request in info");
    coap.sendResponse(ip, port, packet.messageid, buffer_info, strlen(buffer_info), COAP_CONTENT, COAP_TEXT_PLAIN, packet.token, packet.tokenlen);
}

void callback_coap_temp_hum(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Coap request in temp_hum");
    coap.sendResponse(ip, port, packet.messageid, buffer_temp_hum, strlen(buffer_temp_hum), COAP_CONTENT, COAP_TEXT_PLAIN, packet.token, packet.tokenlen);
}

void callback_coap_MQ2(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Coap request in MQ2");
    coap.sendResponse(ip, port, packet.messageid, buffer_MQ2, strlen(buffer_MQ2), COAP_CONTENT, COAP_TEXT_PLAIN, packet.token, packet.tokenlen);
}

void callback_coap_PPM(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Coap request in PPM");
    coap.sendResponse(ip, port, packet.messageid, buffer_PPM, strlen(buffer_PPM), COAP_CONTENT, COAP_TEXT_PLAIN, packet.token, packet.tokenlen);
}
//********************************HTTP vars***********************************************
const char* connectSensor = "http://192.168.1.133:8080/sensor"; //post
//const char* getSensor = "http://192.168.1.133:8080/sensor?id=3030"; //Get
StaticJsonDocument<JSON_OBJECT_SIZE(256)> data_doc;

void httpSetup(){
    HTTPClient http;
    Serial.println("Post request");
    http.begin("http://192.168.1.133:8080/sensor");
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST("{\"id\":\"3030\"}");

    //int httpCode = http.POST("id=3030");

    // httpCode will be negative on error
    if(httpCode > 0) {
        // HTTP header has been send and Server response header has been handled
        Serial.print("[HTTP] POST... code: ");
        Serial.println(httpCode);
    } else {
        Serial.print("[HTTP] POST... failed, error: ");
        Serial.println(http.errorToString(httpCode).c_str());
    }
    http.end();
}
//********************************UTILITY functions***************************************
float average(float *arr, int len){
    float sum = 0;  
    for(int i = 0; i<len; i++) 
            sum += arr[i];
    return sum / len;
}

int computeAQI(float avg){
    return avg >= MAX_GAS_VALUE ? 0 : (avg < MIN_GAS_VALUE ? 2 : 1);
}


//serialization
void serializeData(float RSS, float t, float h, float smoke, float avg, float CO, float CO2, float alcohol, float toluen, float NH4, float aceton){
    //print
    info_doc["id"] = id;    info_doc["RSS"] = RSS;    info_doc["gps"]["lat"] = lat;    info_doc["gps"]["lon"] = lon;  //json for the info topic
    temp_hum_doc["temperature"] = t;    temp_hum_doc["humidity"] = h;  //json for the temperature humidity topic 
    MQ2_doc["smoke"] = smoke;   MQ2_doc["AQI"] = AQI; MQ2_doc["avg"] = avg;    //json for the MQ2 sensor
    PPM_doc["CO"] = CO;    PPM_doc["CO2"] = CO2;    PPM_doc["al"] = alcohol;   PPM_doc["to"] = toluen;    PPM_doc["NH4"] = NH4;    PPM_doc["ac"] = aceton; //PPM json    
    //send it 
    serializeJson(info_doc, buffer_info);
    serializeJson(temp_hum_doc, buffer_temp_hum);
    serializeJson(MQ2_doc, buffer_MQ2);
    serializeJson(PPM_doc, buffer_PPM);
    
}

void setup(){
    //serial output
	Serial.begin(115200);
    //dht sensor
    dht.begin();
    //mq sensors
    MQ135.setRegressionMethod(1);
    MQ135.init();
    
    MQ2.setRegressionMethod(1);
    MQ2.setA(574.25);
    MQ2.setB(-2.222);
    MQ2.init();

    float calcR0MQ2 = 0;
    float calcR0MQ135 = 0;
    Serial.println("Sensors calibration");
    for(int i = 0; i<10; i++){   
        MQ135.update();
        MQ2.update(); // Update data, the arduino will read the voltage from the analog pin
        calcR0MQ2 += MQ2.calibrate(RatioMQ2CleanAir);
        calcR0MQ135 += MQ135.calibrate(RatioMQ135CleanAir);
        Serial.print(".");
    }
    MQ2.setR0(calcR0MQ2/10);
    MQ135.setR0(calcR0MQ135/10);
    Serial.println(" done!.");

    if(isinf(calcR0MQ2)) {Serial.println("Warning: Conection issue, R0_MQ2 is infinite (Open circuit detected) please check your wiring and supply"); while(1);}
    if(calcR0MQ2 == 0){Serial.println("Warning: Conection issue found, R0_MQ2 is zero (Analog pin shorts to ground) please check your wiring and supply"); while(1);}
    if(isinf(calcR0MQ135)) {Serial.println("Warning: Conection issue, R0_MQ135 is infinite (Open circuit detected) please check your wiring and supply"); while(1);}
    if(calcR0MQ135 == 0){Serial.println("Warning: Conection issue found, R0_MQ135 is zero (Analog pin shorts to ground) please check your wiring and supply"); while(1);}
    
    //WIFI CONNECTION
    Serial.print("Attempting to connect to: ");
    Serial.println(ssid);
	while (status != WL_CONNECTED){
		status = WiFi.begin(ssid, pwd);
        Serial.print(".");
		delay(5000);
	}
	Serial.print("\nConnected with ip: ");
	Serial.println(WiFi.localIP());
    delay(250);
    StaticJsonDocument<JSON_OBJECT_SIZE(2)> post_id;
    post_id["id"] = 3030;
    char buffer_id[sizeof(post_id)];
    serializeJson(post_id, buffer_id);
    int err = 0;
    httpSetup();
    delay(250);
    mqtt_connect();
    coap.server(callback_coap_info, info_topic);
    coap.server(callback_coap_temp_hum, temp_hum_topic);
    coap.server(callback_coap_MQ2, MQ2_topic);
    coap.server(callback_coap_PPM, PPM_topic);
    coap.start(5683);
}

long lastMsg = 0;

void loop(){
    if(WiFi.status() != WL_CONNECTED){
        WiFi.reconnect();
        while (WiFi.status() != WL_CONNECTED) {
            delay(500);
            Serial.print(".");
        }
    }

    //process mqtt keepalive and check if there is an update on the different parameters with the callback
    mqttClient.loop();
    //WiFi stats 
    long mill = millis();
    if(mill - lastMsg > SAMPLE_FREQ){
        //If using http i do the update only inside the main loop, otherwise i just loop the mqtt client and the callback will do the trick
        //prepare the HTTP request for the update of the state, actually could just use mqtt since i have to loop
        Serial.println("Getting parameters from server");
        //HTTP used only for communicating to the server that a new sensor connected
        /*int httpCode = httpGet.GET();

        // httpCode will be negative on error
        if(httpCode > 0) {
            // HTTP header has been send and Server response header has been handled
            Serial.print("[HTTP] GET... code: ");
            Serial.println(httpCode);
            // file found at server
            if(httpCode == HTTP_CODE_OK) {
                const char* payload = httpGet.getString().c_str();
                deserializeJson(data_doc, payload);
                SAMPLE_FREQ = data_doc["sampleFrequency"];
                MAX_GAS_VALUE = data_doc["gasMax"];
                MIN_GAS_VALUE = data_doc["gasMin"];
                protocol = data_doc["proto"];
            }
        } else {
            Serial.print("[HTTP] GET... failed, error: ");
            Serial.println(httpGet.errorToString(httpCode).c_str());
        }
        httpGet.end();*/
        RSS = WiFi.RSSI();
        Serial.println("--------- Data -----------");
        Serial.print("WiFi RSS Strength: ");
        Serial.println(RSS);
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        // Check if any reads failed and exit early (to try again).
        if (isnan(t) || isnan(h)) {    
            Serial.println("Failed to read from DHT sensor!");
            delay(SAMPLE_FREQ);
            return;
        }

        MQ2.update(); // Update data
        float smokeV = MQ2.getVoltage();//get the voltage of the smoke
        array_avg[shifting_index] = smokeV;//add the voltage to the average

        float smoke = MQ2.readSensor();//get the PPM of the smoke*/

        MQ135.update(); // Update data

        MQ135.setA(605.18); MQ135.setB(-3.937); // Configure the equation to calculate CO concentration value
        float CO = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

        MQ135.setA(77.255); MQ135.setB(-3.18); //Configure the equation to calculate Alcohol concentration value
        float alcohol = MQ135.readSensor(); // SSensor will read PPM concentration using the model, a and b values set previously or from the setup

        MQ135.setA(110.47); MQ135.setB(-2.862); // Configure the equation to calculate CO2 concentration value
        float CO2 = MQ135.readSensor()+400; // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

        MQ135.setA(44.947); MQ135.setB(-3.445); // Configure the equation to calculate Toluen concentration value
        float toluen = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

        MQ135.setA(102.2 ); MQ135.setB(-2.473); // Configure the equation to calculate NH4 concentration value
        float NH4 = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

        MQ135.setA(34.668); MQ135.setB(-3.369); // Configure the equation to calculate Aceton concentration value
        float aceton = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

        shifting_index += 1;
        shifting_index %= WINDOW;

        if(n_sample < WINDOW)
            n_sample += 1;

        //compute AQI
        float avg = average(array_avg, n_sample);       
        AQI = computeAQI(avg);

        //serialize as json
        serializeData(RSS, t, h, smoke, avg, CO, CO2, alcohol, toluen, NH4, aceton);
        lastMsg = mill;
        if(protocol == 1){
            Serial.println("MQTT Publish");
            mqttClient.publish(info_topic, buffer_info, 0);
            mqttClient.publish(temp_hum_topic, buffer_temp_hum, 0);
            mqttClient.publish(MQ2_topic, buffer_MQ2, 0);
            mqttClient.publish(PPM_topic, buffer_PPM, 0);
        }else if(protocol == 2){
            Serial.println("CoAP loop");
        }else{
            Serial.println("No protocol selected");
        }
    }

    
    
    if((protocol != 1) && (protocol == 2)){
        coap.loop();
    }
        
}
