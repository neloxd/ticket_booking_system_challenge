import QRCode from 'qrcode';

export const generateQrDataUrl = (payload: string): Promise<string> =>
  QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });

export const generateQrBuffer = (payload: string): Promise<Buffer> =>
  QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
