#include <OneWire.h>
#include <DallasTemperature.h>

// --- Cấu hình cho DS18B20 ---
const int oneWireBus = 4; // Chân GPIO 4
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);

// --- Cấu hình cho Module SIM A767X ---
#define RXD2 16
#define TXD2 17

// Hàm phụ trợ để gửi lệnh AT và đợi phản hồi
String sendATCommand(String command, const int timeout) {
  String response = "";
  Serial2.println(command);
  
  long int time = millis();
  while ((time + timeout) > millis()) {
    while (Serial2.available()) {
      char c = Serial2.read();
      response += c;
    }
  }
  return response;
}

// Hàm kiểm tra tình trạng SIM 4G
void checkSIM4G() {
  Serial.println("\n--- DANG KIEM TRA MODULE SIM 4G ---");
  
  // 1. Kiểm tra kết nối cơ bản
  Serial.print("Kiem tra giao tiep (AT): ");
  String resAT = sendATCommand("AT", 1000);
  if (resAT.indexOf("OK") != -1) {
    Serial.println("OK");
  } else {
    Serial.println("Loi! Khong thay module SIM phan hoi.");
  }

  // 2. Kiểm tra tình trạng nhận SIM
  Serial.print("Kiem tra the SIM (AT+CPIN?): ");
  String resCPIN = sendATCommand("AT+CPIN?", 1000);
  if (resCPIN.indexOf("READY") != -1) {
    Serial.println("SIM OK (READY)");
  } else {
    Serial.println("Loi the SIM! (Chua gan SIM hoac SIM bi hong/khoa PIN)");
  }

  // 3. Kiểm tra chất lượng sóng (Cường độ tín hiệu)
  Serial.print("Kiem tra song (AT+CSQ): ");
  String resCSQ = sendATCommand("AT+CSQ", 1000);
  // Loại bỏ các ký tự xuống dòng dư thừa khi in ra log
  resCSQ.trim(); 
  Serial.println("\n  -> Ket qua: " + resCSQ);

  // 4. Kiểm tra trạng thái đăng ký mạng 4G/LTE
  Serial.print("Kiem tra mang 4G (AT+CPSI?): ");
  String resCPSI = sendATCommand("AT+CPSI?", 1000);
  resCPSI.trim();
  Serial.println("\n  -> Ket qua: " + resCPSI);
  
  Serial.println("-----------------------------------\n");
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);

  // Bật pull-up nội bộ cho cảm biến nhiệt độ
  pinMode(oneWireBus, INPUT_PULLUP);
  sensors.begin();
  
  // Chờ 2 giây để mạch SIM khởi động xong (một số mạch cần thời gian boot dài hơn)
  delay(2000); 
  
  // Chạy hàm kiểm tra SIM
  checkSIM4G();
}

void loop() {
  // 1. Đọc cảm biến nhiệt độ
  sensors.requestTemperatures(); 
  float tempC = sensors.getTempCByIndex(0);

  if (tempC != DEVICE_DISCONNECTED_C) {
    Serial.print("Nhiet do hien tai: ");
    Serial.print(tempC);
    Serial.println(" °C");
  } else {
    Serial.println("Loi: Khong doc duoc du lieu tu cam bien DS18B20.");
  }

  // 2. Lắng nghe nếu có bất kỳ tin nhắn/phản hồi nào từ SIM module tự động gửi tới
  while (Serial2.available()) {
    char c = Serial2.read();
    Serial.write(c);
  }

  delay(2000); 
}