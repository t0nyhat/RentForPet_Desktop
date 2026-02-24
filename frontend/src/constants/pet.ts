import i18n from "../i18n";

// Species keys for translation (0-5 mapping)
export const speciesKeys = ["dog", "cat", "rodent", "bird", "reptile", "other"] as const;
export type SpeciesKey = (typeof speciesKeys)[number];

// Species icons
const speciesIcons: Record<string, string> = {
  dog: "🐕",
  cat: "🐱",
  rodent: "🐹",
  bird: "🐦",
  reptile: "🦎",
  other: "🐾",
};

// Get localized species options
export const getSpeciesOptions = () =>
  speciesKeys.map((key, index) => ({
    value: index,
    label: i18n.t(`pet:species.${key}`),
    icon: speciesIcons[key],
    key,
  }));

// Get localized gender options
export const getGenderOptions = () => [
  { value: 0, label: i18n.t("pet:gender.male") },
  { value: 1, label: i18n.t("pet:gender.female") },
];

// Get localized dog gender options
export const getDogGenderOptions = () => [
  { value: 0, label: i18n.t("pet:dogGender.male") },
  { value: 1, label: i18n.t("pet:dogGender.female") },
];

export const getGenderLabel = (gender: number, species: number): string => {
  if (species === 0) {
    return gender === 0 ? i18n.t("pet:dogGender.male") : i18n.t("pet:dogGender.female");
  }
  return gender === 0 ? i18n.t("pet:gender.male") : i18n.t("pet:gender.female");
};

export const getSpeciesLabel = (species: number): string => {
  const key = speciesKeys[species] || "other";
  return i18n.t(`pet:species.${key}`);
};

export const getSpeciesIcon = (species: number): string => {
  const key = speciesKeys[species] || "other";
  return speciesIcons[key] || "🐾";
};
