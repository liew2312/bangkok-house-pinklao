import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "D:/บิลหอพัก/เว็บจัดการหอพัก/outputs/meter_reading_2026-07-28";
const rows = [
  ["S1",426.1,852.2,866,892],["S2",null,null,773,774],["S3",2416.9,2848.7,838,872],["S4",8853.9,8869.4,780,780],["S5",209.6,null,24,27],["S6",8452.8,8866.9,767,772],["S7",4045.4,4114.1,217,219],["S8",3012.5,3095.8,222,235],
  ["101",6586.2,6996.7,83,100],["102",2318.9,2343.1,657,658],["103",5700.6,5767.9,767,774],["104",4113.6,4253.6,770,772],["105",5522.7,5629.5,870,890],["106",4783.9,4820.4,824,825],["107",7059,7089.3,70,74],["108",6449.9,6657.7,709,713],["109",5260.5,5270.4,499,499],["110",9136.9,9540.6,484,495],["111",5913.5,6144.4,533,543],["112",7635.3,7780.5,507,509],["113",1965.8,1981.7,517,520],["114",4617,4642.6,441,462],["115",1428.5,1791.1,919,921],["116",5987,6071,748,757],["117",3953.1,4166.4,979,984],
  ["118",3084,3239,700,705],["119",4994.4,5245.8,556,558],["120",4301.5,4410,806,818],["121",7539.1,7678.1,874,879],["122",5836.6,5836.6,999,0],["123",6489.8,6780.3,384,386],["124",5963.9,6081,462,465],["125",3767.3,3816.1,623,624],["126",2479.2,2548.1,262,268],
  ["202",2091.2,2260.7,896,916],["203",552.9,751.6,382,386],["204",539.3,605.3,395,399],["205",8404,8751.4,940,944],["206",2669.1,2846.7,623,633],["207",2623.8,2691.9,739,742],["208",4429.5,4454.5,144,149],["209",1743.3,1836.4,402,403],["210",5596.9,5821.4,534,541],["211",2451.9,2560.3,875,884],["212",2366.8,2411.4,909,911],["213",395.4,554.1,632,634],["214",941.3,1054.5,271,273],["215",260.1,724.3,386,396],["216",1120,1255.8,888,897],["217",5332.8,5651.5,554,560],
  ["218",3878.4,4135.6,834,837],["219",377.5,470,266,268],["220",5483.5,5645.5,577,579],["221",6474.1,6667.5,407,410],["222",2094.1,2149.1,910,929],["223",588,625.6,760,763],["224",2602.8,2670,329,332],["225",1728.4,1889.5,779,784],["226",5473.1,5680.7,488,495],
  ["301",15.9,15.9,239,239],["302",486,486,344,344],["303",2065.2,2229.7,486,492],["304",3180.5,3276.5,639,642],["305",25.6,26.9,270,270],["306",2.1,2.1,185,185],["307",4364.3,4805.9,495,507],["308",4002.9,4157.5,956,956],["309",1037.1,1396.9,877,881],["310",5156.7,5326.2,534,538],["311",3192.4,3237.8,387,389],["312",2427.8,2534.1,644,646],["313",4441.3,4541.4,287,304],["314",6203.4,6220.1,585,585],["315",1729.5,1788.9,824,827],["316",39.4,287.7,942,943]
];

const wb = Workbook.create();
const ws = wb.worksheets.add("บันทึกมิเตอร์");
ws.showGridLines = false;
ws.getRange("A1:G1").merge();
ws.getRange("A1").values = [["บันทึกเลขมิเตอร์น้ำ-ไฟ ประจำเดือนกรกฎาคม 2569"]];
ws.getRange("A2:G2").merge();
ws.getRange("A2").values = [["วันที่จดมิเตอร์: 28 กรกฎาคม 2569 (28/07/2026)"]];
ws.getRange("A4:G4").values = [["เลขที่ห้อง","ไฟครั้งก่อน","ไฟครั้งนี้","หน่วยไฟที่ใช้","น้ำครั้งก่อน","น้ำครั้งนี้","หน่วยน้ำที่ใช้"]];
ws.getRange(`A5:C${4 + rows.length}`).values = rows.map(r => [r[0],r[1],r[2]]);
ws.getRange(`E5:F${4 + rows.length}`).values = rows.map(r => [r[3],r[4]]);
ws.getRange("D5").formulas = [["=IF(COUNT(B5:C5)<2,\"\",C5-B5)"]];
ws.getRange(`D5:D${4 + rows.length}`).fillDown();
ws.getRange("G5").formulas = [["=IF(COUNT(E5:F5)<2,\"\",IF(F5<E5,F5+1000-E5,F5-E5))"]];
ws.getRange(`G5:G${4 + rows.length}`).fillDown();

const last = 4 + rows.length;
ws.getRange(`A${last + 2}:G${last + 2}`).merge();
ws.getRange(`A${last + 2}`).values = [["หมายเหตุ: สูตรหน่วยน้ำรองรับกรณีมิเตอร์หมุนครบ 999 แล้วกลับเป็น 000 (เช่น ห้อง 122 ใช้น้ำ 1 หน่วย)"]];
ws.getRange(`A${last + 4}:G${last + 4}`).values = [["รายการพิเศษ","ไฟครั้งก่อน","ไฟครั้งนี้","หน่วยไฟที่ใช้","น้ำครั้งก่อน","น้ำครั้งนี้","หน่วยน้ำที่ใช้"]];
ws.getRange(`A${last + 5}:C${last + 6}`).values = [["เครื่องซักผ้า",495.1,507.5],["ห้องเก็บของ",null,null]];
ws.getRange(`D${last + 5}`).formulas = [[`=C${last + 5}-B${last + 5}`]];
ws.getRange(`E${last + 5}:F${last + 6}`).values = [[null,null],[418.5,418.6]];
ws.getRange(`G${last + 6}`).formulas = [[`=F${last + 6}-E${last + 6}`]];

ws.getRange("A1:G1").format = { fill: "#1F4E78", font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "center", verticalAlignment: "center" };
ws.getRange("A2:G2").format = { fill: "#D9EAF7", font: { italic: true, color: "#1F1F1F" }, horizontalAlignment: "center" };
ws.getRange("A4:G4").format = { fill: "#2F75B5", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
ws.getRange(`A5:G${last}`).format.borders = { preset: "all", style: "thin", color: "#B7C9D6" };
ws.getRange(`A5:A${last}`).format.horizontalAlignment = "center";
ws.getRange(`B5:G${last}`).format.horizontalAlignment = "right";
ws.getRange(`B5:C${last}`).format.numberFormat = "0000.0";
ws.getRange(`E5:F${last}`).format.numberFormat = "000";
ws.getRange(`D5:D${last}`).format.numberFormat = "0.0";
ws.getRange(`G5:G${last}`).format.numberFormat = "0";
ws.getRange(`D5:D${last}`).format.fill = "#FFF2CC";
ws.getRange(`G5:G${last}`).format.fill = "#E2F0D9";
ws.getRange(`A${last + 4}:G${last + 4}`).format = { fill: "#5B9BD5", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
ws.getRange(`A${last + 5}:G${last + 6}`).format.borders = { preset: "all", style: "thin", color: "#B7C9D6" };
ws.getRange(`A${last + 2}:G${last + 2}`).format = { font: { italic: true, color: "#7F6000" }, fill: "#FFF2CC", wrapText: true };
ws.getRange("A:A").format.columnWidth = 13;
ws.getRange("B:C").format.columnWidth = 15;
ws.getRange("D:D").format.columnWidth = 14;
ws.getRange("E:F").format.columnWidth = 15;
ws.getRange("G:G").format.columnWidth = 14;
ws.getRange("1:1").format.rowHeight = 28;
ws.getRange("4:4").format.rowHeight = 32;
ws.freezePanes.freezeRows(4);

const table = ws.tables.add(`A4:G${last}`, true, "MeterReadings");
table.showBandedColumns = false;

const check = await wb.inspect({ kind: "table", range: `บันทึกมิเตอร์!A1:G${last + 6}`, include: "values,formulas", tableMaxRows: 8, tableMaxCols: 7 });
console.log(check.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula errors" });
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: "บันทึกมิเตอร์", range: `A1:G${last + 6}`, scale: 1, format: "png" });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const file = await SpreadsheetFile.exportXlsx(wb);
await file.save(`${outputDir}/ตารางจดเลขมิเตอร์_28-07-2569.xlsx`);
