// Static calling codes and display masks from the original form, audited 2026-09-07.
// No Tilda JavaScript or remote country lookup is used at runtime.
export interface PhoneCountry { iso: string; name: string; dial: string; mask: string }
export const phoneCountries: PhoneCountry[] = [
  {
    "iso": "AF",
    "name": "Afghanistan (افغانستان)",
    "dial": "+93",
    "mask": "00-000-0000"
  },
  {
    "iso": "AL",
    "name": "Albania (Shqipëri)",
    "dial": "+355",
    "mask": "(000) 000-000"
  },
  {
    "iso": "DZ",
    "name": "Algeria (الجزائر)",
    "dial": "+213",
    "mask": "00-000-0000"
  },
  {
    "iso": "AD",
    "name": "Andorra",
    "dial": "+376",
    "mask": "000-000"
  },
  {
    "iso": "AO",
    "name": "Angola",
    "dial": "+244",
    "mask": "(000) 000-000"
  },
  {
    "iso": "AM",
    "name": "Armenia (Հայաստան)",
    "dial": "+374",
    "mask": "00-000-000"
  },
  {
    "iso": "AG",
    "name": "Antigua and Barbuda",
    "dial": "+1 (268)",
    "mask": "000-0000"
  },
  {
    "iso": "AR",
    "name": "Argentina",
    "dial": "+54",
    "mask": "(000) 0000-0000"
  },
  {
    "iso": "AU",
    "name": "Australia",
    "dial": "+61",
    "mask": "00-0000-0000"
  },
  {
    "iso": "AT",
    "name": "Austria (Österreich)",
    "dial": "+43",
    "mask": "(000) 000-00000"
  },
  {
    "iso": "AZ",
    "name": "Azerbaijan (Azərbaycan)",
    "dial": "+994",
    "mask": "00-000-00-00"
  },
  {
    "iso": "BS",
    "name": "Bahamas",
    "dial": "+1 (242)",
    "mask": "000-0000"
  },
  {
    "iso": "BH",
    "name": "Bahrain (البحرين)",
    "dial": "+973",
    "mask": "0000-0000"
  },
  {
    "iso": "BD",
    "name": "Bangladesh (বাংলাদেশ)",
    "dial": "+880",
    "mask": "0000-000000"
  },
  {
    "iso": "BB",
    "name": "Barbados",
    "dial": "+1 (246)",
    "mask": "000-0000"
  },
  {
    "iso": "BY",
    "name": "Belarus (Беларусь)",
    "dial": "+375",
    "mask": "(00) 000-00-00"
  },
  {
    "iso": "BE",
    "name": "Belgium (België)",
    "dial": "+32",
    "mask": "(000) 000-000"
  },
  {
    "iso": "BZ",
    "name": "Belize",
    "dial": "+501",
    "mask": "000-0000"
  },
  {
    "iso": "BJ",
    "name": "Benin (Bénin)",
    "dial": "+229",
    "mask": "00-00-0000"
  },
  {
    "iso": "BT",
    "name": "Bhutan (འབྲུག)",
    "dial": "+975",
    "mask": "0-000-0000"
  },
  {
    "iso": "BO",
    "name": "Bolivia",
    "dial": "+591",
    "mask": "0-000-0000"
  },
  {
    "iso": "BA",
    "name": "Bosnia and Herzegovina",
    "dial": "+387",
    "mask": "00-000-0000"
  },
  {
    "iso": "BW",
    "name": "Botswana",
    "dial": "+267",
    "mask": "00-000-000"
  },
  {
    "iso": "BR",
    "name": "Brazil (Brasil)",
    "dial": "+55",
    "mask": "(00) 00000-0000"
  },
  {
    "iso": "BN",
    "name": "Brunei",
    "dial": "+673",
    "mask": "000-0000"
  },
  {
    "iso": "BG",
    "name": "Bulgaria (България)",
    "dial": "+359",
    "mask": "(000) 000-000"
  },
  {
    "iso": "BF",
    "name": "Burkina Faso",
    "dial": "+226",
    "mask": "00-00-0000"
  },
  {
    "iso": "BI",
    "name": "Burundi (Uburundi)",
    "dial": "+257",
    "mask": "00-00-0000"
  },
  {
    "iso": "KH",
    "name": "Cambodia (កម្ពុជា)",
    "dial": "+855",
    "mask": "00-000-000"
  },
  {
    "iso": "CM",
    "name": "Cameroon (Cameroun)",
    "dial": "+237",
    "mask": "0-00-00-00-00"
  },
  {
    "iso": "CA",
    "name": "Canada",
    "dial": "+1",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "CV",
    "name": "Cape Verde (Kabu Verdi)",
    "dial": "+238",
    "mask": "(000) 00-00"
  },
  {
    "iso": "BQ",
    "name": "Caribbean Netherlands",
    "dial": "+599",
    "mask": "0-000-0000"
  },
  {
    "iso": "KY",
    "name": "Cayman Islands",
    "dial": "+1",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "CF",
    "name": "Central African Republic (République centrafricaine)",
    "dial": "+236",
    "mask": "00-00-0000"
  },
  {
    "iso": "TD",
    "name": "Chad (Tchad)",
    "dial": "+235",
    "mask": "00-00-00-00"
  },
  {
    "iso": "CL",
    "name": "Chile",
    "dial": "+56",
    "mask": "0-0000-0000"
  },
  {
    "iso": "CN",
    "name": "China (中国)",
    "dial": "+86",
    "mask": "(000) 0000-0000"
  },
  {
    "iso": "CO",
    "name": "Colombia",
    "dial": "+57",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "KM",
    "name": "Comoros (جزر القمر)",
    "dial": "+269",
    "mask": "00-00000"
  },
  {
    "iso": "CD",
    "name": "Congo (DRC) (Jamhuri ya Kidemokrasia ya Kongo)",
    "dial": "+243",
    "mask": "(000) 000-000"
  },
  {
    "iso": "CG",
    "name": "Congo (Republic) (Congo-Brazzaville)",
    "dial": "+242",
    "mask": "00-000-0000"
  },
  {
    "iso": "CK",
    "name": "Cook Islands",
    "dial": "+682",
    "mask": "00-000"
  },
  {
    "iso": "CR",
    "name": "Costa Rica",
    "dial": "+506",
    "mask": "0000-0000"
  },
  {
    "iso": "CI",
    "name": "Cote d’Ivoire",
    "dial": "+225",
    "mask": "00-00-00-0000"
  },
  {
    "iso": "HR",
    "name": "Croatia (Hrvatska)",
    "dial": "+385",
    "mask": "00-000-0000"
  },
  {
    "iso": "CU",
    "name": "Cuba",
    "dial": "+53",
    "mask": "0-000-0000"
  },
  {
    "iso": "CY",
    "name": "Cyprus (Κύπρος)",
    "dial": "+357",
    "mask": "00-000-000"
  },
  {
    "iso": "CZ",
    "name": "Czech Republic (Česká republika)",
    "dial": "+420",
    "mask": "000-000-000"
  },
  {
    "iso": "DK",
    "name": "Denmark (Danmark)",
    "dial": "+45",
    "mask": "00-00-00-00"
  },
  {
    "iso": "DJ",
    "name": "Djibouti",
    "dial": "+253",
    "mask": "00-00-00-00"
  },
  {
    "iso": "DM",
    "name": "Dominica",
    "dial": "+1 (767)",
    "mask": "000-0000"
  },
  {
    "iso": "DO",
    "name": "Dominican Republic (República Dominicana)",
    "dial": "+1",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "EC",
    "name": "Ecuador",
    "dial": "+593",
    "mask": "00-000-0000"
  },
  {
    "iso": "EG",
    "name": "Egypt (مصر)",
    "dial": "+20",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "SV",
    "name": "El Salvador",
    "dial": "+503",
    "mask": "00-00-0000"
  },
  {
    "iso": "GQ",
    "name": "Equatorial Guinea (Guinea Ecuatorial)",
    "dial": "+240",
    "mask": "00-000-0000"
  },
  {
    "iso": "ER",
    "name": "Eritrea",
    "dial": "+291",
    "mask": "0-000-000"
  },
  {
    "iso": "EE",
    "name": "Estonia (Eesti)",
    "dial": "+372",
    "mask": "0000-0000"
  },
  {
    "iso": "ET",
    "name": "Ethiopia",
    "dial": "+251",
    "mask": "00-000-0000"
  },
  {
    "iso": "FJ",
    "name": "Fiji",
    "dial": "+679",
    "mask": "000-0000"
  },
  {
    "iso": "FI",
    "name": "Finland (Suomi)",
    "dial": "+358",
    "mask": "000-0000000"
  },
  {
    "iso": "FR",
    "name": "France",
    "dial": "+33",
    "mask": "(000) 00-00-00"
  },
  {
    "iso": "GA",
    "name": "Gabon",
    "dial": "+241",
    "mask": "0-00-00-00"
  },
  {
    "iso": "GM",
    "name": "Gambia",
    "dial": "+220",
    "mask": "(000) 00-00"
  },
  {
    "iso": "GE",
    "name": "Georgia (საქართველო)",
    "dial": "+995",
    "mask": "(000) 000-000"
  },
  {
    "iso": "DE",
    "name": "Germany (Deutschland)",
    "dial": "+49",
    "mask": "(000) 000-000000"
  },
  {
    "iso": "GH",
    "name": "Ghana (Gaana)",
    "dial": "+233",
    "mask": "(000) 000-000"
  },
  {
    "iso": "GR",
    "name": "Greece (Ελλάδα)",
    "dial": "+30",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "GD",
    "name": "Grenada",
    "dial": "+1 (473)",
    "mask": "000-0000"
  },
  {
    "iso": "GT",
    "name": "Guatemala",
    "dial": "+502",
    "mask": "0-000-0000"
  },
  {
    "iso": "GN",
    "name": "Guinea (Guinée)",
    "dial": "+224",
    "mask": "000-00-00-00"
  },
  {
    "iso": "GW",
    "name": "Guinea-Bissau (Guiné Bissau)",
    "dial": "+245",
    "mask": "0-000000"
  },
  {
    "iso": "GY",
    "name": "Guyana",
    "dial": "+592",
    "mask": "000-0000"
  },
  {
    "iso": "HT",
    "name": "Haiti",
    "dial": "+509",
    "mask": "00-00-0000"
  },
  {
    "iso": "HN",
    "name": "Honduras",
    "dial": "+504",
    "mask": "0000-0000"
  },
  {
    "iso": "HK",
    "name": "Hong Kong (香港)",
    "dial": "+852",
    "mask": "0000-0000"
  },
  {
    "iso": "HU",
    "name": "Hungary (Magyarország)",
    "dial": "+36",
    "mask": "(000) 000-000"
  },
  {
    "iso": "IS",
    "name": "Iceland (Ísland)",
    "dial": "+354",
    "mask": "000-0000"
  },
  {
    "iso": "IN",
    "name": "India (भारत)",
    "dial": "+91",
    "mask": "(0000) 000-000"
  },
  {
    "iso": "ID",
    "name": "Indonesia",
    "dial": "+62",
    "mask": "(000) 000-00-0000"
  },
  {
    "iso": "IR",
    "name": "Iran (ایران)",
    "dial": "+98",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "IQ",
    "name": "Iraq (العراق)",
    "dial": "+964",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "IE",
    "name": "Ireland",
    "dial": "+353",
    "mask": "(000) 000-000"
  },
  {
    "iso": "IL",
    "name": "Israel (ישראל)",
    "dial": "+972",
    "mask": "000-000-0000"
  },
  {
    "iso": "IT",
    "name": "Italy (Italia)",
    "dial": "+39",
    "mask": "(000) 0000-000"
  },
  {
    "iso": "JM",
    "name": "Jamaica",
    "dial": "+1",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "JP",
    "name": "Japan (日本)",
    "dial": "+81",
    "mask": "00-0000-0000"
  },
  {
    "iso": "JO",
    "name": "Jordan (الأردن)",
    "dial": "+962",
    "mask": "0-0000-0000"
  },
  {
    "iso": "KZ",
    "name": "Kazakhstan (Казахстан)",
    "dial": "+7",
    "mask": "(000) 000-00-00"
  },
  {
    "iso": "KE",
    "name": "Kenya",
    "dial": "+254",
    "mask": "000-000000"
  },
  {
    "iso": "KI",
    "name": "Kiribati",
    "dial": "+686",
    "mask": "0000-0000"
  },
  {
    "iso": "XK",
    "name": "Kosovo (Republic)",
    "dial": "+383",
    "mask": "00-000-000"
  },
  {
    "iso": "KW",
    "name": "Kuwait (الكويت)",
    "dial": "+965",
    "mask": "0000-0000"
  },
  {
    "iso": "KG",
    "name": "Kyrgyzstan (Кыргызстан)",
    "dial": "+996",
    "mask": "(000) 000-000"
  },
  {
    "iso": "LA",
    "name": "Laos (ລາວ)",
    "dial": "+856",
    "mask": "00-000-000"
  },
  {
    "iso": "LV",
    "name": "Latvia (Latvija)",
    "dial": "+371",
    "mask": "00-000-000"
  },
  {
    "iso": "LB",
    "name": "Lebanon (لبنان)",
    "dial": "+961",
    "mask": "00-000-000"
  },
  {
    "iso": "LS",
    "name": "Lesotho",
    "dial": "+266",
    "mask": "0-000-0000"
  },
  {
    "iso": "LR",
    "name": "Liberia",
    "dial": "+231",
    "mask": "00-000-0000"
  },
  {
    "iso": "LY",
    "name": "Libya (ليبيا)",
    "dial": "+218",
    "mask": "00-000-000"
  },
  {
    "iso": "LI",
    "name": "Liechtenstein",
    "dial": "+423",
    "mask": "000-00-00"
  },
  {
    "iso": "LT",
    "name": "Lithuania (Lietuva)",
    "dial": "+370",
    "mask": "(000) 00-000"
  },
  {
    "iso": "LU",
    "name": "Luxembourg",
    "dial": "+352",
    "mask": "(000) 000-000"
  },
  {
    "iso": "MO",
    "name": "Macao",
    "dial": "+853",
    "mask": "0000-0000"
  },
  {
    "iso": "MK",
    "name": "Macedonia (FYROM) (Македонија)",
    "dial": "+389",
    "mask": "00-000-000"
  },
  {
    "iso": "MG",
    "name": "Madagascar (Madagasikara)",
    "dial": "+261",
    "mask": "00-00-00000"
  },
  {
    "iso": "MW",
    "name": "Malawi",
    "dial": "+265",
    "mask": "0-0000-0000"
  },
  {
    "iso": "MY",
    "name": "Malaysia",
    "dial": "+60",
    "mask": "00-0000-0000"
  },
  {
    "iso": "MV",
    "name": "Maldives",
    "dial": "+960",
    "mask": "000-0000"
  },
  {
    "iso": "ML",
    "name": "Mali",
    "dial": "+223",
    "mask": "00-00-0000"
  },
  {
    "iso": "MT",
    "name": "Malta",
    "dial": "+356",
    "mask": "0000-0000"
  },
  {
    "iso": "MH",
    "name": "Marshall Islands",
    "dial": "+692",
    "mask": "000-0000"
  },
  {
    "iso": "MR",
    "name": "Mauritania (موريتانيا)",
    "dial": "+222",
    "mask": "00-00-0000"
  },
  {
    "iso": "MU",
    "name": "Mauritius (Moris)",
    "dial": "+230",
    "mask": "000-00000"
  },
  {
    "iso": "MX",
    "name": "Mexico (México)",
    "dial": "+52",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "MB",
    "name": "Mexico (México)",
    "dial": "+521",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "FM",
    "name": "Micronesia",
    "dial": "+691",
    "mask": "000-0000"
  },
  {
    "iso": "MD",
    "name": "Moldova (Republica Moldova)",
    "dial": "+373",
    "mask": "0000-0000"
  },
  {
    "iso": "MC",
    "name": "Monaco",
    "dial": "+377",
    "mask": "00-000-000"
  },
  {
    "iso": "MN",
    "name": "Mongolia (Монгол)",
    "dial": "+976",
    "mask": "00-00-0000"
  },
  {
    "iso": "ME",
    "name": "Montenegro (Crna Gora)",
    "dial": "+382",
    "mask": "00-000-000"
  },
  {
    "iso": "MA",
    "name": "Morocco (المغرب)",
    "dial": "+212",
    "mask": "00-0000-000"
  },
  {
    "iso": "MZ",
    "name": "Mozambique (Moçambique)",
    "dial": "+258",
    "mask": "000-000-000"
  },
  {
    "iso": "MM",
    "name": "Myanmar (Burma) (မြန်မာ)",
    "dial": "+95",
    "mask": "00-000-000"
  },
  {
    "iso": "NA",
    "name": "Namibia (Namibië)",
    "dial": "+264",
    "mask": "00-000-0000"
  },
  {
    "iso": "NR",
    "name": "Nauru",
    "dial": "+674",
    "mask": "000-0000"
  },
  {
    "iso": "NP",
    "name": "Nepal (नेपाल)",
    "dial": "+977",
    "mask": "000-000-0000"
  },
  {
    "iso": "NL",
    "name": "Netherlands (Nederland)",
    "dial": "+31",
    "mask": "00-000-0000"
  },
  {
    "iso": "NC",
    "name": "New Caledonia",
    "dial": "+687",
    "mask": " 00-00-00"
  },
  {
    "iso": "NZ",
    "name": "New Zealand",
    "dial": "+64",
    "mask": "(000)000-0000"
  },
  {
    "iso": "NI",
    "name": "Nicaragua",
    "dial": "+505",
    "mask": "0000-0000"
  },
  {
    "iso": "NE",
    "name": "Niger (Nijar)",
    "dial": "+227",
    "mask": "00-00-0000"
  },
  {
    "iso": "NG",
    "name": "Nigeria",
    "dial": "+234",
    "mask": "000-000-0000"
  },
  {
    "iso": "NU",
    "name": "Niue",
    "dial": "+683",
    "mask": "0000"
  },
  {
    "iso": "KP",
    "name": "North Korea (조선 민주주의 인민 공화국)",
    "dial": "+850",
    "mask": "00-000-000"
  },
  {
    "iso": "NO",
    "name": "Norway (Norge)",
    "dial": "+47",
    "mask": "(000) 00-000"
  },
  {
    "iso": "OM",
    "name": "Oman (عُمان)",
    "dial": "+968",
    "mask": "00-000-000"
  },
  {
    "iso": "PA",
    "name": "Panama",
    "dial": "+507",
    "mask": "0000-0000"
  },
  {
    "iso": "PK",
    "name": "Pakistan (پاکستان)",
    "dial": "+92",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "PW",
    "name": "Palau",
    "dial": "+680",
    "mask": "000-0000"
  },
  {
    "iso": "PS",
    "name": "Palestinian Territory",
    "dial": "+970",
    "mask": "00 000 0000"
  },
  {
    "iso": "PG",
    "name": "Papua New Guinea",
    "dial": "+675",
    "mask": "(000) 00-000"
  },
  {
    "iso": "PY",
    "name": "Paraguay",
    "dial": "+595",
    "mask": "(000) 000-000"
  },
  {
    "iso": "PE",
    "name": "Peru (Perú)",
    "dial": "+51",
    "mask": "(000) 000-000"
  },
  {
    "iso": "PH",
    "name": "Philippines",
    "dial": "+63",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "PL",
    "name": "Poland (Polska)",
    "dial": "+48",
    "mask": "(000) 000-000"
  },
  {
    "iso": "PT",
    "name": "Portugal",
    "dial": "+351",
    "mask": "00-000-0000"
  },
  {
    "iso": "QA",
    "name": "Qatar (قطر)",
    "dial": "+974",
    "mask": "0000-0000"
  },
  {
    "iso": "RO",
    "name": "Romania (România)",
    "dial": "+40",
    "mask": "00-000-0000"
  },
  {
    "iso": "RU",
    "name": "Russian Federation (Российская Федерация)",
    "dial": "+7",
    "mask": "(000) 000-00-00"
  },
  {
    "iso": "RW",
    "name": "Rwanda",
    "dial": "+250",
    "mask": "(000) 000-000"
  },
  {
    "iso": "KN",
    "name": "Saint Kitts and Nevis",
    "dial": "+1 (869)",
    "mask": "000-0000"
  },
  {
    "iso": "LC",
    "name": "Saint Lucia",
    "dial": "+1 (758)",
    "mask": "000-0000"
  },
  {
    "iso": "VC",
    "name": "Saint Vincent and the Grenadines",
    "dial": "+1 (784)",
    "mask": "000-0000"
  },
  {
    "iso": "WS",
    "name": "Samoa",
    "dial": "+685",
    "mask": "00-0000"
  },
  {
    "iso": "SM",
    "name": "San Marino",
    "dial": "+378",
    "mask": "0000-000000"
  },
  {
    "iso": "ST",
    "name": "Sao Tome and Principe (São Tomé e Príncipe)",
    "dial": "+239",
    "mask": "00-00000"
  },
  {
    "iso": "SA",
    "name": "Saudi Arabia (المملكة العربية السعودية)",
    "dial": "+966",
    "mask": "0-0000-0000"
  },
  {
    "iso": "SN",
    "name": "Senegal (Sénégal)",
    "dial": "+221",
    "mask": "00-000-0000"
  },
  {
    "iso": "RS",
    "name": "Serbia (Србија)",
    "dial": "+381",
    "mask": "00-000-0000"
  },
  {
    "iso": "SC",
    "name": "Seychelles",
    "dial": "+248",
    "mask": "0-000-000"
  },
  {
    "iso": "SL",
    "name": "Sierra Leone",
    "dial": "+232",
    "mask": "00-000000"
  },
  {
    "iso": "SG",
    "name": "Singapore",
    "dial": "+65",
    "mask": "0000-0000"
  },
  {
    "iso": "SK",
    "name": "Slovakia (Slovensko)",
    "dial": "+421",
    "mask": "(000) 000-000"
  },
  {
    "iso": "SI",
    "name": "Slovenia (Slovenija)",
    "dial": "+386",
    "mask": "00-000-000"
  },
  {
    "iso": "SB",
    "name": "Solomon Islands",
    "dial": "+677",
    "mask": "000-0000"
  },
  {
    "iso": "SO",
    "name": "Somalia (Soomaaliya)",
    "dial": "+252",
    "mask": "000-000-000"
  },
  {
    "iso": "ZA",
    "name": "South Africa",
    "dial": "+27",
    "mask": "00-000-0000"
  },
  {
    "iso": "KR",
    "name": "South Korea (대한민국)",
    "dial": "+82",
    "mask": "00-0000-0000"
  },
  {
    "iso": "SS",
    "name": "South Sudan (جنوب السودان)",
    "dial": "+211",
    "mask": "00-000-0000"
  },
  {
    "iso": "ES",
    "name": "Spain (España)",
    "dial": "+34",
    "mask": "(000) 000-000"
  },
  {
    "iso": "LK",
    "name": "Sri Lanka (ශ්‍රී ලංකාව)",
    "dial": "+94",
    "mask": "00-000-0000"
  },
  {
    "iso": "SD",
    "name": "Sudan (السودان)",
    "dial": "+249",
    "mask": "00-000-0000"
  },
  {
    "iso": "SR",
    "name": "Suriname",
    "dial": "+597",
    "mask": "000-0000"
  },
  {
    "iso": "SZ",
    "name": "Swaziland",
    "dial": "+268",
    "mask": "00-00-0000"
  },
  {
    "iso": "SE",
    "name": "Sweden (Sverige)",
    "dial": "+46",
    "mask": "00-000-0000"
  },
  {
    "iso": "CH",
    "name": "Switzerland (Schweiz)",
    "dial": "+41",
    "mask": "00-000-0000"
  },
  {
    "iso": "SY",
    "name": "Syria (سوريا)",
    "dial": "+963",
    "mask": "00-0000-000"
  },
  {
    "iso": "TW",
    "name": "Taiwan (台灣)",
    "dial": "+886",
    "mask": "0000-0000"
  },
  {
    "iso": "TJ",
    "name": "Tajikistan",
    "dial": "+992",
    "mask": "00-000-0000"
  },
  {
    "iso": "TZ",
    "name": "Tanzania",
    "dial": "+255",
    "mask": "00-000-0000"
  },
  {
    "iso": "TH",
    "name": "Thailand (ไทย)",
    "dial": "+66",
    "mask": "00-000-0000"
  },
  {
    "iso": "TG",
    "name": "Togo",
    "dial": "+228",
    "mask": "00-000-000"
  },
  {
    "iso": "TO",
    "name": "Tonga",
    "dial": "+676",
    "mask": "00000"
  },
  {
    "iso": "TT",
    "name": "Trinidad and Tobago",
    "dial": "+1 (868)",
    "mask": "000-0000"
  },
  {
    "iso": "TN",
    "name": "Tunisia (تونس)",
    "dial": "+216",
    "mask": "00-000-000"
  },
  {
    "iso": "TR",
    "name": "Turkey (Türkiye)",
    "dial": "+90",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "TM",
    "name": "Turkmenistan",
    "dial": "+993",
    "mask": "0-000-0000"
  },
  {
    "iso": "TV",
    "name": "Tuvalu",
    "dial": "+688",
    "mask": "000000"
  },
  {
    "iso": "UG",
    "name": "Uganda",
    "dial": "+256",
    "mask": "(000) 000-000"
  },
  {
    "iso": "UA",
    "name": "Ukraine (Україна)",
    "dial": "+380",
    "mask": "(00) 000-00-00"
  },
  {
    "iso": "AE",
    "name": "United Arab Emirates (الإمارات العربية المتحدة)",
    "dial": "+971",
    "mask": "00-000-00000"
  },
  {
    "iso": "GB",
    "name": "United Kingdom",
    "dial": "+44",
    "mask": "00-0000-00000"
  },
  {
    "iso": "US",
    "name": "USA",
    "dial": "+1",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "UY",
    "name": "Uruguay",
    "dial": "+598",
    "mask": "0-000-00-00"
  },
  {
    "iso": "UZ",
    "name": "Uzbekistan (Oʻzbekiston)",
    "dial": "+998",
    "mask": "00-000-0000"
  },
  {
    "iso": "VU",
    "name": "Vanuatu",
    "dial": "+678",
    "mask": "00-00000"
  },
  {
    "iso": "VA",
    "name": "Vatican City (Città del Vaticano)",
    "dial": "+39",
    "mask": "0-000-00000"
  },
  {
    "iso": "VE",
    "name": "Venezuela",
    "dial": "+58",
    "mask": "(000) 000-0000"
  },
  {
    "iso": "VN",
    "name": "Vietnam (Việt Nam)",
    "dial": "+84",
    "mask": "00-0000-000"
  },
  {
    "iso": "YE",
    "name": "Yemen (اليمن)",
    "dial": "+967",
    "mask": "0-000-000"
  },
  {
    "iso": "ZM",
    "name": "Zambia",
    "dial": "+260",
    "mask": "00-000-0000"
  },
  {
    "iso": "ZW",
    "name": "Zimbabwe",
    "dial": "+263",
    "mask": "0-00-0000000"
  },
  {
    "iso": "GP",
    "name": "Guadeloupe",
    "dial": "+590",
    "mask": "000-00-00-00"
  }
];
