#include <WiFi.h>
#include <DHT.h>
#include <MQUnifiedsensor.h>
#include <PubSubClient.h>
#include <HTTPClient.h>

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
#define         PIN_MQ2                 (2)
#define         PIN_MQ135               (15)

//***********************Software Related Macros*****************************************
#define         Type135                 ("MQ-135") 
#define         Type2                   ("MQ-2")
#define         Voltage_Resolution      (3.3) // 3V3, 5 is high
#define         ADC_Bit_Resolution      (12) 
#define         RatioMQ135CleanAir      (3.6) 
#define         RatioMQ2CleanAir        (9.83)
#define         WINDOW                  (5)

//*********************************SETTINGS**********************************************
int ID = 3030;
int SAMPLE_FREQ = 10000;
int MIN_GAS_VALUE = 4095;
int MAX_GAS_VALUE = 500;
int AQI = 2; //0 iv avg > MAX_GAS_VALUE, 1 if MIN_GAS_VALUE < avg < MAX_GAS_VALUE, 2 otherwise
int n_sample = 0;
int shifting_index = 0;
float array_avg[WINDOW] = {-1, -1, -1, -1, -1};//-1 is not a valid argument for the voltage 
char protocol = '1'; //1 is MQTT, 2 is COAP,3 is HTTP (?)

//*********************************SENSORS***********************************************
//dht sensor define 
DHT dht(DHTPIN, DHTTYPE);
//MQ sensor define 
MQUnifiedsensor MQ135(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ135, Type135);
MQUnifiedsensor MQ2(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ2, Type2);

//*********************************WiFi***************************************************
char ssid[] = "SbalziOrmonaliA2.4G";
char pwd[] = "Lovegang126";
float RSS = 0;
int status = WL_IDLE_STATUS;

//*********************************MQTT Broker********************************************
const char *mqtt_broker = "18.191.129.230";
const int mqtt_port = 1883;
const char *mqtt_username = "Prop4et";
const char *mqtt_password = "ProgettoIoT";

const char *topic = "sensor/";
//temp_hum -> temperature and humidity
//info -> RSS, id, gps
//AQI -> AQI <opt: smokeV>
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton
const char *info_topic = "sensor/info";
const char *temp_hum_topic = "sensor/temp_hum";
const char *AQI_topic = "sensor/AQI";
const char *PPM_topic = "sensor/PPM";


//**********************************HTTP**************************************************
char http_hostname[] = "localhost:8080/IoT";

//clients
WiFiClient mqttClient;
WiFiClient httpClient;
PubSubClient client(mqttClient);


//********************************UTILITY FUNCTIONS***************************************
//callback when receiving mqtt response
void callback_response(char *topic, byte *payload, unsigned int length) {
    Serial.print("Message arrived in topic: ");
    Serial.println(topic);
    //check the response and parse to get the right protocol to talk with 
    Serial.print("Message:");
    char p[length+1];
	memcpy(p, payload, length);
    Serial.print(p);
    Serial.println("\n-----------------------");
}
//function for connecting to the mqtt client
void mqtt_connection(){
    client.setServer(mqtt_broker, mqtt_port);
    client.setCallback(callback_response); // setup the callback for the client connection (MQTT) 
    while (!client.connected()) {
        String client_id = "esp32-client-";
        client_id += String(WiFi.macAddress());
        Serial.printf("The client %s connects to the public mqtt broker\n", client_id.c_str());
        if (client.connect(client_id.c_str(), mqtt_username, mqtt_password)) {
            Serial.println("Public emqx mqtt broker connected");
        } else {
            // connection error handler
            Serial.print("failed with state ");
            Serial.print(client.state());
            delay(2000);
        }
    }
}

float average(float *arr, int len){
    float sum = 0;  
    for(int i = 0; i<len; i++) 
            sum += arr[i];
    return sum / len;
}


//send data
void sendData(char protocol, float RSS, float t, float h, float avg, float smokeV, float smoke, float CO, float CO2, float alcohol, float toluen, float NH4, float aceton){
    //conversion in strings because that's how it works
    char buff_RSS[sizeof(double)];
    snprintf(buff_RSS, sizeof(buff_RSS), "%lf", RSS);
    char buff_t[sizeof(double)];
    snprintf(buff_t, sizeof(buff_t), "%lf", t);
    char buff_h[sizeof(double)];
    snprintf(buff_h, sizeof(buff_h), "%lf", h);
    char buff_avg[sizeof(double)];
    snprintf(buff_avg,  sizeof(buff_avg), "%lf", avg);
    if(smokeV < MIN_GAS_VALUE) AQI = 0;
    else if((smokeV > MIN_GAS_VALUE) && (smokeV < MAX_GAS_VALUE)) AQI = 1;
    else AQI = 2;
    char buff_AQI[sizeof(double)];
    snprintf(buff_AQI, sizeof(buff_AQI), "%lf", AQI);
    char buff_smoke[sizeof(double)];
    snprintf(buff_smoke, sizeof(buff_smoke), "%lf", smoke);
    char buff_CO[sizeof(double)];
    snprintf(buff_CO, sizeof(buff_CO), "%lf", CO);
    char buff_CO2[sizeof(double)];
    snprintf(buff_CO2, sizeof(buff_CO2), "%lf", CO2);
    char buff_alchool[sizeof(double)];
    snprintf(buff_alchool, sizeof(buff_alchool), "%lf", alcohol);
    char buff_toluen[sizeof(double)];
    snprintf(buff_toluen, sizeof(buff_toluen), "%lf", toluen);
    char buff_NH4[sizeof(double)];
    snprintf(buff_NH4, sizeof(buff_NH4), "%lf", NH4);
    char buff_aceton[sizeof(double)];
    snprintf(buff_aceton, sizeof(buff_aceton), "%lf", aceton);
    //gotta jsonize the things
    switch(protocol){
        case '1':
            Serial.println("MQTT");
            client.publish(info_topic, buff_RSS, 0);
            client.publish(temp_hum_topic, buff_t, 0);
            client.publish(AQI_topic, buff_avg, 0);
            client.publish(PPM_topic, buff_h, 0);

        break;
        case '2':
        break;
        case '3':
        break;
        default:
            Serial.println("There's no protocol for that");
        break;
    }
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
	while (status != WL_CONNECTED){
		Serial.print("Attempting to connect to: ");
		Serial.println(ssid);
		status = WiFi.begin(ssid, pwd);
		delay(5000);
	}
   
	Serial.println("Connected to");
	Serial.println(WiFi.localIP());
	delay(100);
    char in = Serial.read();
    if(in == '1'|| in == '2' || in == '3'){
        protocol=in;
    }
    delay(250);
}

void loop(){
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

    float smoke = MQ2.readSensor();//get the PPM of the smoke

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

    //send data
    float avg = average(array_avg, n_sample);       

    sendData(protocol, RSS, t, h, avg, smokeV, smoke, CO, CO2, alcohol, toluen, NH4, aceton);

    delay(SAMPLE_FREQ);
}
