declare module "react-simple-maps" {
  import { FC, ReactNode } from "react";

  export const ComposableMap: FC<{
    projection?: string;
    projectionConfig?: Record<string, number | number[]>;
    width?: number;
    height?: number;
    className?: string;
    children?: ReactNode;
  }>;

  export const Geographies: FC<{
    geography: string | object;
    parseGeographies?: (features: unknown[]) => unknown[];
    children: (props: { geographies: unknown[] }) => ReactNode;
    className?: string;
  }>;

  export const Geography: FC<{
    geography: { id?: string | number; rsmKey?: string; svgPath?: string };
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: Record<string, Record<string, string>>;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onClick?: () => void;
    className?: string;
  }>;

  export const ZoomableGroup: FC<{
    center?: [number, number];
    zoom?: number;
    children?: ReactNode;
  }>;
}
