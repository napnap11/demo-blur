"use client";

import React, { useEffect, useRef, useState } from "react";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

interface BlurBackgroundProps {
  imageUrl: string;
}

export default function BlurBackground({ imageUrl }: BlurBackgroundProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useWebGLFallback, setUseWebGLFallback] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current) return;

    const imageElement = imgRef.current;
    const canvas = canvasRef.current;

    async function processImage() {
      try {
        setIsLoading(true);

        // Initialize MediaPipe Selfie Segmentation
        const selfieSegmentation = new SelfieSegmentation({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          },
        });

        selfieSegmentation.setOptions({
          modelSelection: 1, // 0 for general, 1 for landscape
        });

        // Process the image
        selfieSegmentation.onResults((results) => {
          if (!canvas || !imageElement) return;

          const ctx = canvas.getContext("2d")!;
          canvas.width = imageElement.width;
          canvas.height = imageElement.height;

          // Draw the original image
          ctx.drawImage(imageElement, 0, 0);

          // Create a blurred version
          const blurredCanvas = document.createElement("canvas");
          blurredCanvas.width = canvas.width;
          blurredCanvas.height = canvas.height;
          const blurredCtx = blurredCanvas.getContext("2d")!;
          blurredCtx.filter = "blur(10px)";
          blurredCtx.drawImage(imageElement, 0, 0);

          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const blurredData = blurredCtx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

          // Draw segmentation mask to a temporary canvas to access its data
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const maskCtx = maskCanvas.getContext("2d")!;
          maskCtx.drawImage(results.segmentationMask, 0, 0);
          const maskData = maskCtx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

          // Blend original and blurred based on segmentation mask
          for (let i = 0; i < canvas.height; i++) {
            for (let j = 0; j < canvas.width; j++) {
              const pixelIndex = (i * canvas.width + j) * 4;
              const maskValue = maskData.data[pixelIndex] / 255; // Normalize to 0-1

              // If mask value is low (background), use blurred pixel
              if (maskValue < 0.1) {
                imageData.data[pixelIndex] = blurredData.data[pixelIndex];
                imageData.data[pixelIndex + 1] =
                  blurredData.data[pixelIndex + 1];
                imageData.data[pixelIndex + 2] =
                  blurredData.data[pixelIndex + 2];
                imageData.data[pixelIndex + 3] =
                  blurredData.data[pixelIndex + 3];
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);
          setIsLoading(false);
        });

        // Process the image
        await selfieSegmentation.send({ image: imageElement });
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Failed to process the image");
        setUseWebGLFallback(true);
        setIsLoading(false);
      }
    }

    // Handle image loading
    if (!imageElement.complete) {
      imageElement.onload = processImage;
      imageElement.onerror = () => {
        setError("Failed to load image");
        setIsLoading(false);
      };
    } else {
      processImage();
    }
  }, [imageUrl]);

  if (useWebGLFallback) {
    return (
      <div className="relative w-full h-full">
        {/* Background blurred image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "blur(10px)",
            transform: "scale(1.1)", // Prevent blur edges from showing
          }}
        />
        {/* Original image in center */}
        <div className="relative z-10 flex justify-center items-center h-full">
          <img
            src={imageUrl}
            alt="Original"
            className="max-w-full max-h-full object-contain"
            style={{
              maxWidth: "80%", // Adjust this value to control how much of the image is unblurred
              maxHeight: "80%",
            }}
          />
        </div>
      </div>
    );
  }

  if (error && !useWebGLFallback) {
    return <div className="text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <div>Processing image...</div>;
  }

  return (
    <div>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="original"
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: "100%",
          height: "auto",
        }}
      />
    </div>
  );
}
