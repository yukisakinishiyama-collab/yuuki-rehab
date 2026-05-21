'use client'

import { QRCodeSVG } from 'qrcode.react'

const LINE_URL = 'https://lin.ee/uaGKbfk'

export default function LineQRCode() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-2xl shadow-lg inline-block">
        <QRCodeSVG
          value={LINE_URL}
          size={140}
          bgColor="#ffffff"
          fgColor="#00B900"
          level="M"
        />
      </div>
      <p className="text-blue-200 text-xs">カメラで読み取ると直接LINEが開きます</p>
    </div>
  )
}
