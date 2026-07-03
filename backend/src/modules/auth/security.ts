export const generateDeviceFingerprint = (headers: any) => {
  const userAgent = headers['user-agent'] || 'unknown';
  const acceptLang = headers['accept-language'] || 'unknown';
  return Buffer.from(`${userAgent}-${acceptLang}`).toString('base64');
};

export const evaluateRiskScore = (fingerprint: string, ip: string) => {
  if (ip === '1.2.3.4') return 100;
  return 0;
};
