import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stations = [
  {
    name: "Đầu Cồn",
    desc: "Khu đầu cù lao, nơi mặt nước bắt đầu ảnh hưởng trực tiếp đến sinh hoạt và sản xuất.",
    href: "/s/STATION_01",
  },
  {
    name: "Homestay Cô Ba",
    desc: "Khu đón khách, giúp du khách hiểu cách theo dõi môi trường nước tại Cồn Hô.",
    href: "/s/STATION_02",
  },
  {
    name: "Cuối Cồn",
    desc: "Khu cuối cù lao, nơi mực nước và xói lở có tác động rõ hơn đến bờ sông.",
    href: "/s/STATION_03",
  },
];

export default function AboutPage() {
  return (
    <PublicShell activePath="/about">
      <section className="mb-8 max-w-3xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">Giới thiệu</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Cồn Hô là một cù lao sông nhỏ, và nền tảng này công bố dữ liệu môi trường công khai cho mọi người.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Eco-Sense Cồn Hô là bảng quan trắc công khai về độ mặn, mực nước và tình trạng trạm để phục vụ cư dân,
          nhà trường, nhà nghiên cứu, cơ quan quản lý và du khách.
        </p>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.name}>
            <CardHeader>
              <CardTitle>{station.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">{station.desc}</p>
              <Link href={station.href} className="text-sm font-medium text-accent hover:underline">
                Xem trạm trực tiếp
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>QR tại trạm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted">
              Mỗi trạm có mã QR để người dùng mở ngay trang trạm trên điện thoại, xem dữ liệu thực tế và giải thích
              ngắn gọn về điều đang được đo.
            </p>
            <p className="text-sm text-muted">
              Ví dụ: quét mã tại trạm sẽ mở <code className="rounded bg-muted/30 px-1">/s/STATION_01</code>
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard">Mở bảng quan trắc</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Chúng tôi đo gì</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted">
            <p>
              <strong className="text-foreground">Độ mặn</strong> — theo dõi nguy cơ xâm nhập mặn vào vùng sinh hoạt
              và sản xuất.
            </p>
            <p>
              <strong className="text-foreground">Mực nước</strong> — giúp quan sát ngập triều và biến động thủy văn.
            </p>
            <p>
              <strong className="text-foreground">Tình trạng trạm</strong> — cho biết kết nối, pin và sức khỏe thiết bị.
            </p>
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  );
}
