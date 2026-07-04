import type { ThemeConfig } from "antd";

export const palette = {
  turquoise: "#00FFBF",
  turquoiseDark: "#00C99B",
  turquoiseSoft: "#E2FBF3",
  violet: "rgb(83, 2, 224)",
  violetDark: "#4200B0",
  violetSoft: "#F1EBFF",
  ink: "rgb(48, 48, 77)",
  inkMuted: "#6F6F92",
  inkFaint: "#9797B3",
  gray: "rgb(203, 203, 208)",
  grayLight: "#E7E7EC",
  bg: "#F5F5F7",
  panel: "#FFFFFF",
  danger: "#D8483C",
};

export const nodeLabelRu: Record<string, string> = {
  Material: "материал",
  Process: "процесс",
  Equipment: "оборудование",
  Property: "свойство",
  Experiment: "эксперимент",
  Expert: "эксперт",
  Facility: "объект",
};

export const nodeLabelColors: Record<string, { bg: string; border: string; text: string }> = {
  Material: { bg: "#E1FBF2", border: "#8FE4C8", text: "#0E6B52" },
  Process: { bg: "#F1EBFF", border: "#B79CF2", text: "#4A1FA3" },
  Equipment: { bg: "#FFF3DC", border: "#EBC066", text: "#8A5A00" },
  Property: { bg: "#FDE7F1", border: "#EEA9CB", text: "#A1225F" },
  Experiment: { bg: "#E5F1FF", border: "#9CC5F5", text: "#14538F" },
  Expert: { bg: "#FFEDE8", border: "#F0AF9B", text: "#B23A20" },
  Facility: { bg: "#ECEDF2", border: "#C7CBD8", text: "#3E4759" },
  Publication: { bg: "#FFF8D8", border: "#E7D06B", text: "#75620B" },
};

const FONT_FAMILY = '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.turquoise,
    colorInfo: palette.turquoise,
    colorText: palette.ink,
    colorTextSecondary: palette.inkMuted,
    colorTextTertiary: palette.inkFaint,
    colorBorder: palette.gray,
    colorBorderSecondary: palette.grayLight,
    colorBgLayout: palette.bg,
    colorBgContainer: palette.panel,
    colorLink: palette.violet,
    colorLinkHover: palette.violetDark,
    colorError: palette.danger,
    borderRadius: 10,
    lineWidth: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    boxShadow: "none",
    boxShadowSecondary: "none",
    boxShadowTertiary: "none",
  },
  components: {
    Button: {
      colorPrimaryHover: palette.turquoiseDark,
      colorPrimaryActive: palette.turquoiseDark,
      controlHeight: 40,
      fontWeight: 600,
      primaryShadow: "none",
      colorTextLightSolid: palette.ink,
    },
    Input: {
      hoverBorderColor: palette.violet,
      activeBorderColor: palette.violet,
      activeShadow: "none",
      lineWidth: 1.5,
    },
    Tag: {
      defaultBg: palette.grayLight,
      defaultColor: palette.ink,
    },
    Tooltip: {
      fontSize: 13,
    },
    Collapse: {
      headerBg: "transparent",
      contentBg: "transparent",
    },
  },
};
