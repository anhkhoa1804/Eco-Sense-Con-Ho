import type { ObservatoryReferenceItem } from "./types";

/**
 * Reference guidance shown on Monitoring.
 *
 * The hard rule here: an externally-published guideline and a number written
 * in a firmware comment must never look alike. Each entry declares its
 * `standing`, and the UI renders the three differently.
 *
 * On units — FAO's irrigation-water guideline is expressed in **ECw (dS/m)**,
 * electrical conductivity. HORIZON displays water salinity in **‰**.
 * Converting between them depends on the ionic composition of the specific
 * water (the common TDS ≈ 640 × EC factor is an approximation for typical
 * irrigation water, not a constant), so this module deliberately does NOT
 * restate FAO's thresholds in ‰. Doing that would manufacture a precise-
 * looking number FAO never published and attach their authority to it. FAO
 * is presented in its own units as context; the project's own ‰ figures stay
 * clearly marked as unverified internal guidance.
 */

const FAO_SOURCE = "FAO Irrigation and Drainage Paper 29 Rev. 1 — Water quality for agriculture (Ayers & Westcot)";
const FAO_URL = "https://www.fao.org/4/t0234e/t0234e01.htm";

export function buildReference(
  threshold: { warningLevel: number; criticalLevel: number } | null,
): ObservatoryReferenceItem[] {
  const items: ObservatoryReferenceItem[] = [
    {
      title: "Độ mặn nước tưới — hướng dẫn quốc tế",
      standing: "external",
      rows: [
        { range: "< 0,7 dS/m", meaning: "Không hạn chế sử dụng" },
        { range: "0,7 – 3,0 dS/m", meaning: "Hạn chế nhẹ đến trung bình" },
        { range: "> 3,0 dS/m", meaning: "Hạn chế nghiêm trọng" },
      ],
      detail:
        "Ngưỡng của FAO tính theo độ dẫn điện của nước tưới (dS/m). HORIZON hiển thị độ mặn theo ‰ — quy đổi giữa hai đơn vị phụ thuộc thành phần ion của từng nguồn nước, nên bảng này là ngữ cảnh tham chiếu, không phải ngưỡng áp trực tiếp lên số đo của trạm.",
      sourceLabel: FAO_SOURCE,
      sourceUrl: FAO_URL,
    },
  ];

  if (threshold) {
    // A threshold configured in crop_thresholds is a real operational
    // setting, but it is the project's own choice — not an external standard.
    items.push({
      title: "Ngưỡng cảnh báo đang dùng",
      standing: "internal",
      rows: [
        { range: `≥ ${threshold.warningLevel.toFixed(2)}‰`, meaning: "Cần chú ý" },
        { range: `≥ ${threshold.criticalLevel.toFixed(2)}‰`, meaning: "Nguy cơ cao" },
      ],
      detail:
        "Giá trị do dự án cấu hình để sinh cảnh báo. Đây là lựa chọn vận hành của HORIZON, chưa được đối chiếu với một nguồn khoa học độc lập.",
      sourceLabel: "Cấu hình hệ thống HORIZON",
      sourceUrl: null,
    });
  } else {
    items.push({
      title: "Ngưỡng cảnh báo độ mặn",
      standing: "unverified",
      rows: [],
      detail:
        "Chưa có ngưỡng cảnh báo nào được cấu hình trong hệ thống. Các con số từng xuất hiện trong ghi chú kỹ thuật nội bộ chưa đủ cơ sở để hiển thị như một khuyến nghị, nên không được nêu ở đây.",
      sourceLabel: null,
      sourceUrl: null,
    });
  }

  items.push({
    title: "Đất và dinh dưỡng",
    standing: "unverified",
    rows: [],
    detail:
      "HORIZON đo được độ ẩm, EC, pH và nhiệt độ đất. Việc diễn giải các giá trị này thành khuyến nghị canh tác phụ thuộc loại cây, loại đất và mùa vụ — dự án chưa xác lập được ngưỡng tham chiếu có nguồn cho bối cảnh Cồn Hô, nên chưa công bố con số nào.",
    sourceLabel: null,
    sourceUrl: null,
  });

  return items;
}
