import { MotionValue, motion, useSpring, useTransform } from "motion/react";
import type React from "react";
import { useEffect } from "react";

type PlaceValue = number | ".";

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

function Number({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });

  return (
    <motion.span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        y,
      }}
    >
      {number}
    </motion.span>
  );
}

function getValueRoundedToPlace(value: number, place: number): number {
  const nearest = Math.round(value);
  const tolerance = 1e-9 * Math.max(1, Math.abs(value));
  const normalized = Math.abs(value - nearest) < tolerance ? nearest : value;
  const scaled = normalized / place;
  return Math.floor(scaled);
}

interface DigitProps {
  place: PlaceValue;
  value: number;
  height: number;
  digitStyle?: React.CSSProperties;
}

function Digit({ place, value, height, digitStyle }: DigitProps) {
  if (place === ".") {
    return (
      <span
        className="relative inline-flex items-center justify-center"
        style={{ height, width: "fit-content", ...digitStyle }}
      >
        .
      </span>
    );
  }

  const valueRoundedToPlace = getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace);

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <span
      className="relative inline-flex overflow-hidden"
      style={{
        height,
        position: "relative",
        width: "1ch",
        fontVariantNumeric: "tabular-nums",
        ...digitStyle,
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: PlaceValue[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: React.CSSProperties["fontWeight"];
  containerStyle?: React.CSSProperties;
  counterStyle?: React.CSSProperties;
  digitStyle?: React.CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: React.CSSProperties;
  bottomGradientStyle?: React.CSSProperties;
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places = [...value.toString()].map((ch, i, a) => {
    if (ch === ".") return ".";
    const dotIndex = a.indexOf(".");
    const isInteger = dotIndex === -1;
    const exponent = isInteger
      ? a.length - i - 1
      : i < dotIndex
        ? dotIndex - i - 1
        : -(i - dotIndex);
    return 10 ** exponent;
  }),
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = "inherit",
  fontWeight = "inherit",
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 0,
  gradientFrom = "transparent",
  gradientTo = "transparent",
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  const height = fontSize + padding;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        ...containerStyle,
      }}
    >
      <span
        style={{
          fontSize,
          display: "flex",
          gap,
          overflow: "hidden",
          borderRadius,
          paddingLeft: horizontalPadding,
          paddingRight: horizontalPadding,
          lineHeight: 1,
          color: textColor,
          fontWeight,
          direction: "ltr",
          ...counterStyle,
        }}
      >
        {places.map((place) => (
          <Digit key={place} place={place} value={value} height={height} digitStyle={digitStyle} />
        ))}
      </span>
      {gradientHeight > 0 && (
        <span
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span
            style={
              topGradientStyle ?? {
                height: gradientHeight,
                background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
              }
            }
          />
          <span
            style={
              bottomGradientStyle ?? {
                height: gradientHeight,
                background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
              }
            }
          />
        </span>
      )}
    </span>
  );
}
