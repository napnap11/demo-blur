"use client";

import React, { useEffect, useRef, useState } from "react";
import { SelfieSegmentation, Results } from "@mediapipe/selfie_segmentation";

interface BlurBackgroundProps {
  imageUrl: string; // The URL of the image to process
}

declare global {
  interface Window {
    SelfieSegmentation: typeof SelfieSegmentation;
  }
}

/**
 * A simplified version of background blur using MediaPipe SelfieSegmentation.
 * - Loads the model from the CDN (already included in _app.tsx)
 * - Once the <img> is loaded, we send it to the segmentation model
 * - Renders the final composite in a <canvas>
 */
export default function BlurBackgroundMediapipe({
  imageUrl,
}: BlurBackgroundProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // We'll store the MediaPipe instance in a ref so we can call send(...)
  const selfieSegmentationRef = useRef<SelfieSegmentation | null>(null);

  /** 1) Initialize the SelfieSegmentation model (client-side). */
  useEffect(() => {
    async function loadModel() {
      try {
        if (typeof window !== "undefined" && window.SelfieSegmentation) {
          const { SelfieSegmentation } = window;
          const selfieSegmentation = new SelfieSegmentation({
            locateFile: (file: string) => {
              // Load from CDN
              return `/models/selfie_segmentation/${file}`;
            },
          });

          // Options: modelSelection 0 or 1
          //  - 0 = general model
          //  - 1 = landscape model (often higher accuracy)
          selfieSegmentation.setOptions({
            modelSelection: 1,
          });

          // Store in ref
          selfieSegmentationRef.current = selfieSegmentation;
          setIsLoading(false);
        } else {
          setError("MediaPipe SelfieSegmentation script not found on window.");
        }
      } catch (err) {
        console.error("Error loading MediaPipe SelfieSegmentation:", err);
        setError("Failed to load MediaPipe SelfieSegmentation model");
      }
    }

    loadModel();
  }, []);

  /**
   * 2) Once the model is loaded and the <img> is ready,
   *    feed the image to the model, then compositing the results on <canvas>.
   */
  useEffect(() => {
    if (isLoading || error) return;
    if (!canvasRef.current || !imgRef.current) return;
    if (!selfieSegmentationRef.current) return;

    // If <img> is not yet loaded, wait for onload
    if (!imgRef.current.complete) {
      imgRef.current.onload = () => processImage();
      imgRef.current.onerror = () => setError("Failed to load the image");
    } else {
      processImage();
    }

    // The main function that calls MediaPipe SelfieSegmentation
    async function processImage() {
      try {
        const segmentation = selfieSegmentationRef.current;
        if (!segmentation) return;

        const imageElement = imgRef.current!;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        // Adjust canvas size to match the image
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;

        // Set up the onResults callback
        segmentation.onResults((results: Results) => {
          try {
            const { segmentationMask, image } = results;

            // 1) Draw the original image (sharp background)
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // 2) Cut out the background (inverse of before)
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(segmentationMask, 0, 0, canvas.width, canvas.height);

            // 3) Now draw the blurred person on top
            ctx.globalCompositeOperation = "destination-over";
            ctx.filter = "blur(10px)";
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // 4) Reset
            ctx.filter = "none";
            ctx.restore();
          } catch (e) {
            console.error("Error in onResults compositing:", e);
            setError("Failed to composite the result");
          }
        });

        // 2) Send the single image to the model
        await segmentation.send({ image: imageElement });
      } catch (err) {
        console.error("Error processing image with MediaPipe:", err);
        setError("Failed to process the image");
      }
    }
  }, [isLoading, error]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <div>Loading MediaPipe model...</div>;
  }

  return (
    <div>
      {/* Hidden <img> to load your target image */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="original"
        style={{ display: "none" }}
      />
      {/* Canvas where the final blurred composite will be rendered */}
      <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />
    </div>
  );
}
