#include <WiFi.h>
#include <PubSubClient.h>
#include <Ethernet.h>
#include <DHT.h>
#include <MQUnifiedsensor.h>

#include <InfluxDbClient.h>

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
#define         Voltage_Resolution      (3.3) // 3V3, 5 iso high
#define         ADC_Bit_Resolution      (12) 
#define         RatioMQ135CleanAir      (3.6) 
#define         RatioMQ2CleanAir        (9.83) 

//*********************************SENSORS***********************************************
//dht sensor define 
DHT dht(DHTPIN, DHTTYPE);
//MQ sensor define 
MQUnifiedsensor MQ135(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ135, Type135);
MQUnifiedsensor MQ2(BOARD, Voltage_Resolution, ADC_Bit_Resolution, PIN_MQ2, Type2);

//db
//InfluxDBClient client(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
//wifi
char ssid[] = "SbalziOrmonaliA2.4G";
char pwd[] = "Lovegang126";

int status = WL_IDLE_STATUS;
//Point sensor("temp_hum");
void setup()
{
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
    for(int i = 0; i<10; i++)
    {   
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

	while (status != WL_CONNECTED)
	{
		Serial.print("Attempting to connect to: ");
		Serial.println(ssid);
		status = WiFi.begin(ssid, pwd);
		delay(5000);
	}
   
	Serial.println("Connected to");
	Serial.println(WiFi.localIP());
	delay(100);
    /*
    //added tag to the message
    sensor.addTag("user", "Biancucci");
    timeSync(TZ_INFO, "pool.ntp.org", "time.nis.gov");
    if(client.validateConnection()){
        Serial.println("connected to influx");
    }else{
        Serial.println("failed to connect to influx");
        Serial.println(client.getLastErrorMessage());
    }*/
    delay(250);
}

    void loop(){
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    // Check if any reads failed and exit early (to try again).
    if (isnan(t) || isnan(h)) {    
        Serial.println("Failed to read from DHT sensor!");
        //sensor.clearFields();
        delay(10000);
        return;
    }

    MQ2.update(); // Update data

    MQ135.update(); // Update data
    
    MQ135.setA(605.18); MQ135.setB(-3.937); // Configure the equation to calculate CO concentration value
    float CO = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

    MQ135.setA(77.255); MQ135.setB(-3.18); //Configure the equation to calculate Alcohol concentration value
    float Alcohol = MQ135.readSensor(); // SSensor will read PPM concentration using the model, a and b values set previously or from the setup

    MQ135.setA(110.47); MQ135.setB(-2.862); // Configure the equation to calculate CO2 concentration value
    float CO2 = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

    MQ135.setA(44.947); MQ135.setB(-3.445); // Configure the equation to calculate Toluen concentration value
    float Toluen = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

    MQ135.setA(102.2 ); MQ135.setB(-2.473); // Configure the equation to calculate NH4 concentration value
    float NH4 = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

    MQ135.setA(34.668); MQ135.setB(-3.369); // Configure the equation to calculate Aceton concentration value
    float Aceton = MQ135.readSensor(); // Sensor will read PPM concentration using the model, a and b values set previously or from the setup

    /*
    We have added 400 PPM because when the library is calibrated it assumes the current state of the
    air as 0 PPM, and it is considered today that the CO2 present in the atmosphere is around 400 PPM.
    */
    Serial.print("Temperature: ");
    Serial.println(t);
    Serial.print("Humidity: ");
    Serial.println(h);
    Serial.print("Smoke: "); Serial.println(MQ2.readSensor());
    Serial.print("CO: "); Serial.println(CO);
    Serial.print("CO2: "); Serial.println(CO2 + 400); 
    Serial.print("Toulene: "); Serial.println(Toluen); 
    Serial.print("NH4: "); Serial.println(NH4); 
    Serial.print("Aceton: "); Serial.println(Aceton);
    Serial.println("");
    delay(11000);
}
