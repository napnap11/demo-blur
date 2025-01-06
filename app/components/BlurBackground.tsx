"use client";

import React, { useEffect, useRef, useState } from "react";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";

interface BlurBackgroundProps {
  imageUrl: string;
}

export default function BlurBackground({ imageUrl }: BlurBackgroundProps) {
  const [model, setModel] = useState<bodyPix.BodyPix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  /**
   * 1) Load the BodyPix model from local files (no internet required).
   */
  useEffect(() => {
    async function loadModel() {
      try {
        setIsLoading(true);
        const loadedModel = await bodyPix.load({
          architecture: 'ResNet50',
          outputStride: 16,
          quantBytes: 4
        });
        setModel(loadedModel);
      } catch (err) {
        console.error("Error loading BodyPix model:", err);
        setError("Failed to load the model");
      } finally {
        setIsLoading(false);
      }
    }
    loadModel();
  }, []);

  /**
   * 2) Once the model is ready, run segmentation to find
   *    the single person nearest the center of the image
   *    and blur everything else.
   */
  useEffect(() => {
    if (!model) return;
    if (!canvasRef.current || !imgRef.current) return;

    const imageElement = imgRef.current;

    // If the <img> isn't fully loaded yet, wait for onload
    if (!imageElement.complete) {
      imageElement.onload = () => {
        canvasRef.current!.width = imageElement.width;
        canvasRef.current!.height = imageElement.height;
        processImage();
      };
      imageElement.onerror = () => setError("Failed to load image");
    } else {
      // If it's already loaded
      canvasRef.current.width = imageElement.width;
      canvasRef.current.height = imageElement.height;
      processImage();
    }

    async function processImage() {
      if (!model || !canvasRef.current || !imgRef.current) return;

      try {
        // --- A) Segment multiple persons ---
        // We want an array of person masks so we can find the one near the center.
        const multiSegmentation = await model.segmentMultiPerson(
          imgRef.current,
          {
            flipHorizontal: false,
            internalResolution: "medium",
            segmentationThreshold: 0.7,
          }
        );

        if (multiSegmentation.length === 0) {
          // If there is no person detected, just draw the original image
          canvasRef.current.getContext("2d")?.drawImage(imgRef.current, 0, 0);
          return;
        }

        const centerX = imgRef.current.width / 2;
        const centerY = imgRef.current.height / 2;

        // --- B) Find the single person closest to center ---
        let closestSeg: bodyPix.PersonSegmentation | null = null;
        let minDist = Infinity;

        for (const seg of multiSegmentation) {
          const { data, width, height } = seg;
          let sumX = 0,
            sumY = 0,
            count = 0;

          // Compute the center of mass for this person's pixels
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = y * width + x;
              // data[i] === 1 means "person pixel" (0 means background)
              if (data[i] === 1) {
                sumX += x;
                sumY += y;
                count++;
              }
            }
          }

          if (count === 0) continue; // no pixels for that seg
          const avgX = sumX / count;
          const avgY = sumY / count;
          const dist = Math.sqrt((avgX - centerX) ** 2 + (avgY - centerY) ** 2);

          // Update minDist
          if (dist < minDist) {
            minDist = dist;
            closestSeg = seg;
          }
        }

        const ctx = canvasRef.current.getContext("2d")!;
        // Draw the original image
        ctx.drawImage(imgRef.current, 0, 0);

        // --- C) Create a blurred version of the entire image ---
        const blurredCanvas = document.createElement("canvas");
        blurredCanvas.width = imgRef.current.width;
        blurredCanvas.height = imgRef.current.height;
        const blurredCtx = blurredCanvas.getContext("2d")!;

        blurredCtx.filter = "blur(10px)";
        blurredCtx.drawImage(imgRef.current, 0, 0);

        // We'll overlay the blurred pixels over everything except the chosen center person
        const finalImageData = ctx.getImageData(
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height
        );
        const blurredData = blurredCtx.getImageData(
          0,
          0,
          blurredCanvas.width,
          blurredCanvas.height
        );

        // Start by marking EVERYTHING as "should be blurred" = 1
        const toBlurMask = new Uint8Array(ctx.canvas.width * ctx.canvas.height);
        for (let i = 0; i < toBlurMask.length; i++) {
          toBlurMask[i] = 1;
        }

        // Then, if we found a center person, mark those pixels as "do not blur" = 0
        // Note: Because we used `internalResolution='medium'`, the segmentation mask
        // might be smaller than the image. For perfect alignment, you'd have to
        // rescale the segmentation data to match the full image size.
        // Here, for brevity, assume the resolution matches.
        if (closestSeg) {
          const { data, width, height } = closestSeg;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = y * width + x;
              if (data[i] === 1) {
                // Mark "do not blur"
                toBlurMask[i] = 0;
              }
            }
          }
        }

        // --- D) Merge the blurred and original images ---
        for (let i = 0; i < toBlurMask.length; i++) {
          if (toBlurMask[i] === 1) {
            const idx = i * 4;
            finalImageData.data[idx + 0] = blurredData.data[idx + 0];
            finalImageData.data[idx + 1] = blurredData.data[idx + 1];
            finalImageData.data[idx + 2] = blurredData.data[idx + 2];
            finalImageData.data[idx + 3] = blurredData.data[idx + 3];
          }
        }
        ctx.putImageData(finalImageData, 0, 0);
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Failed to process the image");
      }
    }
  }, [model]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <div>Loading model...</div>;
  }

  return (
    <div>
      {/* Hidden <img> to load the original image */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt="original"
        style={{ display: "none" }}
      />
      {/* Canvas where we render the final composite */}
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
