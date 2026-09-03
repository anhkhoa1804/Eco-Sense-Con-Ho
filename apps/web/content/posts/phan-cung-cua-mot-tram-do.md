---
title: Phần cứng của một trạm đo, và vì sao chọn từng món
excerpt: Ba nhóm thiết bị, mỗi nhóm trả lời một câu hỏi khác nhau — kèm phần đang còn dang dở mà hệ thống chưa che giấu.
category: Thiết kế hệ thống
date: 2026-04-02
readingTime: 6 phút đọc
cover: /assets/illustrations/station-water-placeholder.svg
status: draft
---

Trang chủ nói HORIZON đo nước, đất và không khí. Bài này nói bằng thiết bị gì,
và vì sao lại là những thiết bị đó.

Toàn bộ nội dung dưới đây là **thiết kế của hệ thống**. Phần cứng chưa được lắp
đặt ngoài thực địa. Các sơ đồ trên trang chủ là hình minh họa kỹ thuật, không
phải ảnh chụp thiết bị đã dựng.

## Nhóm 1 — Nước (Trạm Nước)

**A02YYUW.** Cảm biến siêu âm đo khoảng cách tới mặt nước, từ đó suy ra mực
nước. Chọn siêu âm vì đầu đo không cần chạm nước: không có bộ phận ngâm lâu
ngày trong nước lợ, nên ít hỏng và ít phải bảo trì hơn phao cơ khí.

**ES-EC-WT-01.** Đầu dò độ dẫn điện trong nước, dùng để suy ra độ mặn.

Đây là điểm còn dang dở lớn nhất của hệ thống: **phần đọc giá trị từ đầu dò này
chưa được lập trình.** Trạm có phần cứng để đo độ mặn, nhưng firmware chưa lấy
được số từ nó. Giao diện nói rõ điều đó thay vì hiển thị một con số trống rỗng.

Vì chưa đọc được đầu dò, dự án cũng chưa hiệu chuẩn được quan hệ giữa độ dẫn
điện và độ mặn tại chỗ. Đó là lý do HORIZON không quy đổi giữa ‰ và dS/m: quan
hệ đó phụ thuộc thành phần ion và nhiệt độ của chính vùng nước này, không có
hằng số chung nào dùng được.

## Nhóm 2 — Đất và không khí (Trạm Đất)

**ES-SM-THEC-01.** Đầu dò cắm trong đất, đo cùng lúc độ ẩm, độ dẫn điện và
nhiệt độ của đất. Một đầu dò cho ba chỉ số nghĩa là ba giá trị luôn đến từ cùng
một điểm và cùng một thời điểm — quan trọng khi muốn so sánh chúng với nhau.

**ES-PH-SOIL-01.** Đầu dò đo độ pH của đất.

**SHT30.** Cảm biến nhiệt độ và độ ẩm không khí ngay tại vườn. Đây là lý do
trang Quan trắc phân biệt rõ "nhiệt độ không khí tại trạm" với "nhiệt độ khu
vực" lấy từ nguồn ngoài: một cái là phép đo tại chỗ, một cái là dự báo theo ô
lưới.

## Nhóm 3 — Truyền dữ liệu (Gateway)

**SX1278 (LoRa).** Đường truyền tầm xa, điện năng thấp giữa hai trạm đo và
gateway. Chọn LoRa vì nơi đặt trạm không cần có sóng di động — chỉ gateway mới
cần.

**Mô-đun di động.** Gateway là điểm duy nhất cần kết nối internet; nó gom dữ
liệu, ký xác thực rồi gửi về hệ thống.

**ESP32.** Vi điều khiển chạy trên cả ba thiết bị, đọc cảm biến và quản lý chu
kỳ gửi dữ liệu.

## Vì sao chia làm ba vai trò

Đặt cùng một bộ cảm biến ở cả ba nơi sẽ rẻ hơn về mặt thiết kế, và tệ hơn về
mặt thông tin. Trên một dải đất rộng ba trăm mét, điều kiện ở mép sông và ở
giữa vườn khác nhau — nên mỗi điểm đo thứ mà vị trí đó trả lời được tốt nhất,
còn gateway không đo gì cả mà lo việc đưa số liệu ra khỏi cồn.
