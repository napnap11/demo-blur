import BlurBackgroundMediapipe from "./components/BlurBackgroundMediapipe";
import Script from "next/script";
export default function DemoPage() {
  const imageUrl =
    "/images/ec_youngvic_afaceinthecrowd_webportrait_700x900px_new.jpg";
  return (
    <div className="p-4">
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"
        strategy="beforeInteractive"
      />
      {/* (Optional) MediaPipe Camera Utils, not strictly needed for single images */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        strategy="beforeInteractive"
      />
      <h1 className="text-xl font-bold mb-4">Mediapipe Single Image Blur</h1>
      <BlurBackgroundMediapipe imageUrl={imageUrl} />
    </div>
  );
}
