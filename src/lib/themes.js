import tinycolor from "tinycolor2";
import { colorsWithAlpha } from "./constants";

const presetThemesContext = require.context(
  "../preset-themes/",
  false,
  /.*\.json/
);

export const bgImages = require.context(
  "../images/patterns/",
  false,
  /bg-.*\.svg/
);

const defaultTheme = presetThemesContext("./default.json");

export const themesEqual = (themeA, themeB) =>
  // HACK: "deep equal" via stringify
  // http://www.mattzeunert.com/2016/01/28/javascript-deep-equal.html
  JSON.stringify(themeA) === JSON.stringify(themeB);

export const makeTinycolor = colorIn => {
  let a = colorIn.a;
  if (typeof a !== "undefined" && a > 1.0) {
    // HACK: If the alpha channel is > 1.0 then assume it's a percentage that
    // needs to be normalized to 0.0 - 1.0 range
    a = Math.floor(a) / 100.0;
  }
  return tinycolor({...colorIn, a});
};

export const colorToCSS = colorIn => makeTinycolor(colorIn).toRgbString();

export const normalizeThemeBackground = background =>
  bgImages.keys().includes(background) ? background : null;

// Utility to ensure normal & consistent colors
export const normalizeThemeColor = (data, defaultColor) =>
  makeTinycolor(data || defaultColor).toRgb();

export const normalizeThemeColors = (colors = {}) => {
  const out = {};
  const { colors: defaultColors } = defaultTheme;
  Object.keys(defaultColors).forEach(name => {
    const color = normalizeThemeColor(colors[name], defaultColors[name]);
    if (!colorsWithAlpha.includes(name)) {
      delete color.a;
    }
    out[name] = color;
  });
  return out;
};

// Utility to ensure normal properties and values in app theme state
export const normalizeTheme = (data = {}) => {
  const theme = {
    colors: normalizeThemeColors(data.colors, defaultTheme.colors),
    images: {
      additional_backgrounds: []
    }
  };
  const images = data.images ? data.images : {};
  if (images.headerURL) {
    const background = normalizeThemeBackground(images.headerURL);
    if (background) {
      theme.images.additional_backgrounds = [background];
    }
  }
  if (images.additional_backgrounds) {
    const background = normalizeThemeBackground(
      images.additional_backgrounds[0]
    );
    if (background) {
      theme.images.additional_backgrounds = [background];
    }
  }
  return theme;
};

export const presetThemes = presetThemesContext
  .keys()
  .map((filename, idx) => ({
    idx,
    filename,
    ...normalizeTheme(presetThemesContext(filename))
  }))
  .sort(({ filename: a }, { filename: b }) => a.localeCompare(b));
