#include <WiFi.h>
#include <WiFiUdp.h>
#include <DHT.h>
#include <MQUnifiedsensor.h>
#include <PubSubClient.h>
#include <coap-simple.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

/*#define INFLUXDB_URL "https://eu-central-1-1.aws.cloud2.influxdata.com"
#define INFLUXDB_TOKEN "hQJ9ONu00iM6k4Nhy-ZrJidVLBg0i_iW_asBtnzSKIZivgHhnj6t3jUZ8KdtAp-4JGY4i6lg8Fu62leWf0T1qw=="
#define INFLUXDB_ORG "francostanco97@gmail.com"
#include <InfluxDbCloud.h>
#define INFLUXDB_BUCKET "iotdemo"*/

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
float MAX_GAS_VALUE = 4995;
int AQI = 2; //0 if avg > MAX_GAS_VALUE, 1 if MIN_GAS_VALUE < avg < MAX_GAS_VALUE, 2 otherwise
int n_sample = 0;
int shifting_index = 0;
float array_avg[WINDOW] = {-1, -1, -1, -1, -1};//-1 is not a valid argument for the voltage 
char protocol = '2'; //1 is MQTT, 2 is COAP
const int doc_info_capacity = JSON_OBJECT_SIZE(3) + JSON_OBJECT_SIZE(2);
const int doc_temp_hum_capacity = JSON_OBJECT_SIZE(2);
const int doc_MQ2_capacity = JSON_OBJECT_SIZE(3);
const int doc_PPM_capacity = JSON_OBJECT_SIZE(6);
StaticJsonDocument<doc_info_capacity> info_doc;
StaticJsonDocument<doc_temp_hum_capacity> temp_hum_doc;
StaticJsonDocument<doc_MQ2_capacity> MQ2_doc;
StaticJsonDocument<doc_PPM_capacity> PPM_doc;
char buffer_id[sizeof(info_doc)];
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
const char *info_topic = "sensor/info";
const char *temp_hum_topic = "sensor/temp_hum";
const char *MQ2_topic = "sensor/MQ2";
const char *PPM_topic = "sensor/PPM";
//topic to receive parameters
const char *min_v_topic = "sensor/minv";
const char *max_v_topic = "sensor/maxv";
const char *read_freq_topic = "sensor/freq";
const char *protocol_topic = "sensor/protocol";

//clients
WiFiClient mqttClient;
WiFiUDP coapServer;
PubSubClient client(mqttClient);
Coap coap(coapServer);
//******************************************MQTT functions*********************************
//callback when receiving mqtt response
void callback_response_mqtt(char *topic, byte *payload, unsigned int length) {
    /*StaticJsonDocument<256> doc;
    deserializeJson(doc, (const byte*)payload, length);*/
    Serial.print("Message arrived in topic: ");
    Serial.println(topic);
    //check the response and parse to get the right protocol to talk with 
    Serial.print("Message:");
    char p[length+1];
	memcpy(p, payload, length);
    Serial.println(p);
    Serial.println("-----------------------");
}
//function for connecting to the mqtt client
void mqtt_connect(){
    client.setServer(mqtt_broker, mqtt_port);
    client.setCallback(callback_response_mqtt); // setup the callback for the client connection (MQTT) 
    while (!client.connected()) {
        String client_id = "esp32-client-";
        client_id += String(WiFi.macAddress());
        Serial.printf("Trying to connect to the mqtt broker");
        if (client.connect(client_id.c_str(), mqtt_username, mqtt_password)) {
            Serial.println("Connected");
            //subscribe here
            client.subscribe(min_v_topic);
            client.subscribe(max_v_topic);
            client.subscribe(read_freq_topic);
            client.subscribe(protocol_topic);
            Serial.println("Subscribed for updates");
        } else {
            // connection error handler
            Serial.print("Connection failed with state ");
            Serial.print(client.state());
            delay(2000);
        }
    }
}

//********************************COAP functions******************************************
void callback_coap_info(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Request arrived on Coap");
    coap.sendResponse(ip, port, packet.messageid, buffer_id);
}

void callback_coap_temp_hum(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Request arrived on Coap");
    coap.sendResponse(ip, port, packet.messageid, buffer_temp_hum);
}

void callback_coap_MQ2(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Request arrived on Coap");
    coap.sendResponse(ip, port, packet.messageid, buffer_MQ2);
}

void callback_coap_PPM(CoapPacket &packet, IPAddress ip, int port){
    Serial.println("Request arrived on Coap");
    coap.sendResponse(ip, port, packet.messageid, buffer_PPM);
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
    /*Serial.print("info: "); Serial.print(id); Serial.print(" "); Serial.print(RSS); Serial.print(" "); Serial.print(lon); Serial.print(" "); Serial.println(lat);
    Serial.print("temperature and humidity: "); Serial.print(t); Serial.print(" "); Serial.println(h);     //gotta jsonize the things
    Serial.print("MQ2: "); Serial.print(AQI); Serial.print(" "); Serial.print(smoke); Serial.print(" "); Serial.println(avg);
    Serial.print("PPM: "); Serial.print(CO); Serial.print(" "); Serial.print(CO2); Serial.print(" "); Serial.print(" "); Serial.print(alcohol); Serial.print(" "); Serial.print(toluen); Serial.print(" "); Serial.print(NH4); Serial.print(" "); Serial.println(aceton);
    */
    info_doc["id"] = id;    info_doc["RSS"] = RSS;    info_doc["gps"]["lat"] = lat;    info_doc["gps"]["lon"] = lon;  //json for the info topic
    temp_hum_doc["temperature"] = t;    temp_hum_doc["humidity"] = h;  //json for the temperature humidity topic 
    MQ2_doc["smoke"] = smoke;   MQ2_doc["AQI"] = AQI; MQ2_doc["avg"] = avg;    //json for the MQ2 sensor
    PPM_doc["CO"] = CO;    PPM_doc["CO2"] = CO2;    PPM_doc["alcohol"] = alcohol;   PPM_doc["toluen"] = toluen;    PPM_doc["NH4"] = NH4;    PPM_doc["aceton"] = aceton; //PPM json    
    //send it 
    serializeJson(info_doc, buffer_id);
    serializeJson(temp_hum_doc, buffer_temp_hum);
    serializeJson(MQ2_doc, buffer_MQ2);
    serializeJson(PPM_doc, buffer_PPM);
    
}

//Point sensor("temp_hum");
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
	Serial.println("\nConnected with ip: ");
	Serial.println(WiFi.localIP());
    delay(250);
    mqtt_connect();
    coap.server(callback_coap_info, "info");
    coap.server(callback_coap_temp_hum, "temp_hum");
    coap.server(callback_coap_MQ2, "MQ2");
    coap.server(callback_coap_PPM, "PPM");

    coap.start(5683);
}

long lastMsg = 0;
void loop(){
    //to test, if this works i have to send the new protocol both with coap and mqtt
    if(protocol == '1')
        client.loop();
    if(protocol == '2')
        coap.loop();
    //WiFi stats 

    RSS = WiFi.RSSI();
    Serial.println("--------- Data -----------");
    Serial.print("WiFi RSS Strength: ");
    Serial.println(RSS);
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    // Check if any reads failed and exit early (to try again).
    if (isnan(t) || isnan(h)) {    
        Serial.println("Failed to read from DHT sensor!");
        //sensor.clearFields();
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
    if(protocol == '1'){
        Serial.println("-------MQTT SEND-------");
        client.publish(info_topic, buffer_id, 0);
        client.publish(temp_hum_topic, buffer_temp_hum, 0);
        client.publish(MQ2_topic, buffer_MQ2, 0);
        client.publish(PPM_topic, buffer_PPM, 0);
    }else if(protocol == '2');
    else{
        Serial.println("No protocol selected, defaulting to MQTT");
        protocol = '1';
    }
    delay(SAMPLE_FREQ);
}
