/**
 * Công thức tính tiền (đồng bộ với sp_TaoDonThue):
 *   SoNgay   = CEILING(tổng phút thuê / 1440), tối thiểu 1 ngày
 *   TienThue = SoNgay x GiaThueNgay
 *   TienCoc  = MIN(TienCoc của xe, TienThue)  -- trả trước, trừ vào tổng tiền
 *   PhiTre   = CEILING(phút trễ / 60) x 50.000đ   (QuyTacPhi LATE, PER_HOUR)
 *   PhiHuy   = 10% TienThue khi huỷ đơn đã CONFIRMED, tối đa bằng số đã trả
 *   TongPhaiTra = TienThue + Σ PhiPhatSinh
 */
function quote(giaThueNgay, tienCocXe, nhan, tra) {
  const minutes = Math.round((tra.getTime() - nhan.getTime()) / 60000);
  const soNgay = Math.max(1, Math.ceil(minutes / 1440));
  const tienThue = soNgay * Number(giaThueNgay);
  const tienCoc = Math.min(Number(tienCocXe), tienThue);
  return { soNgay, donGia: Number(giaThueNgay), tienThue, tienCoc, conLaiKhiNhanXe: tienThue - tienCoc };
}

module.exports = { quote };
