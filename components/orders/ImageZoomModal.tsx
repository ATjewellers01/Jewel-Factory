'use client';

import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  isOpen: boolean;
  images: string[];
  productName?: string;
  designNumber?: string;
  onClose: () => void;
};

export function ImageZoomModal({ isOpen, images, productName, designNumber, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const next = () => setCurrentIndex((i) => (i + 1) % images.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  if (!isOpen || !images.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      {/* Modal content */}
      <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/90 hover:bg-white p-2 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-foreground" />
        </button>

        {/* Image container */}
        <div className="relative flex-1 overflow-hidden bg-[#fbf9f5] rounded-t-2xl flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[currentIndex]}
            alt={productName || 'Product image'}
            className="max-h-full max-w-full object-contain p-4"
          />

          {/* Navigation arrows (if multiple images) */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white p-2 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white p-2 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* Product details */}
        <div className="border-t bg-white px-6 py-4 rounded-b-2xl space-y-2">
          {productName && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Product Name</p>
              <p className="text-sm font-semibold text-foreground">{productName}</p>
            </div>
          )}
          {designNumber && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Design Number</p>
              <p className="font-mono text-sm font-semibold text-[#c9a84c]">{designNumber}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
