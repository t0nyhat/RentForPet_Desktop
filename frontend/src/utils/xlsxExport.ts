import { strToU8, zipSync } from "fflate";

const XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const XLSX_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DOC_CORE_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties";
const DOC_DC_NS = "http://purl.org/dc/elements/1.1/";
const DOC_DCTERMS_NS = "http://purl.org/dc/terms/";
const DOC_XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const columnLetter = (index: number) => {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

const buildCellXml = (ref: string, value: unknown, styleIndex = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleIndex}"><v>${value}</v></c>`;
  }

  if (typeof value === "boolean") {
    return `<c r="${ref}" s="${styleIndex}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  const text = value === null || value === undefined ? "" : String(value);
  const escaped = xmlEscape(text);
  const preserveSpace = text.startsWith(" ") || text.endsWith(" ");
  const tAttr = preserveSpace ? ` xml:space="preserve"` : "";
  return `<c r="${ref}" s="${styleIndex}" t="inlineStr"><is><t${tAttr}>${escaped}</t></is></c>`;
};

const toIsoNow = () => new Date().toISOString();

export const exportRowsToXlsx = ({
  fileName,
  sheetName,
  headers,
  rows,
}: {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}) => {
  const safeSheetName = xmlEscape(sheetName.slice(0, 31) || "Sheet1");
  const createdAt = toIsoNow();
  const lastColumn = columnLetter(Math.max(0, headers.length - 1));
  const lastRow = rows.length + 1;
  const filterRef = headers.length > 0 ? `A1:${lastColumn}${lastRow}` : "A1:A1";

  const colsXml = headers
    .map((header, index) => {
      const base = Math.max(12, Math.min(60, Math.ceil((header.length + 6) * 1.15)));
      return `<col min="${index + 1}" max="${index + 1}" width="${base}" customWidth="1"/>`;
    })
    .join("");

  const headerCellsXml = headers
    .map((header, index) => buildCellXml(`${columnLetter(index)}1`, header, 1))
    .join("");

  const dataRowsXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = headers
        .map((header, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rowNumber}`;
          return buildCellXml(ref, row[header], 0);
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XLSX_MAIN_NS}" xmlns:r="${XLSX_REL_NS}">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1">${headerCellsXml}</row>
    ${dataRowsXml}
  </sheetData>
  <autoFilter ref="${filterRef}"/>
</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${XLSX_MAIN_NS}" xmlns:r="${XLSX_REL_NS}">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XLSX_MAIN_NS}">
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const appPropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PetHotel Desktop</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr"><vt:lpstr>${safeSheetName}</vt:lpstr></vt:vector>
  </TitlesOfParts>
</Properties>`;

  const corePropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="${DOC_CORE_NS}" xmlns:dc="${DOC_DC_NS}" xmlns:dcterms="${DOC_DCTERMS_NS}" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="${DOC_XSI_NS}">
  <dc:creator>PetHotel Desktop</dc:creator>
  <cp:lastModifiedBy>PetHotel Desktop</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`;

  const archive = zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypesXml),
      "_rels/.rels": strToU8(rootRelsXml),
      "docProps/app.xml": strToU8(appPropsXml),
      "docProps/core.xml": strToU8(corePropsXml),
      "xl/workbook.xml": strToU8(workbookXml),
      "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml),
      "xl/styles.xml": strToU8(stylesXml),
      "xl/worksheets/sheet1.xml": strToU8(worksheetXml),
    },
    { level: 6 }
  );

  const archiveBytes = new Uint8Array(archive.byteLength);
  archiveBytes.set(archive);
  const blob = new Blob([archiveBytes.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
