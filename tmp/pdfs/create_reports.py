from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter
import zipfile
import sys, json

OUT = Path('output/pdf/模拟病例报告')
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Chinese', 'C:/Windows/Fonts/simsun.ttc', subfontIndex=0))
FONT = 'Chinese'
reports = [
('血常规', '静脉全血 / EDTA抗凝', [
('白细胞','6.40','10^9/L','3.50-9.50','正常'),('红细胞','4.78','10^12/L','4.30-5.80','正常'),
('血红蛋白','145','g/L','130-175','正常'),('红细胞压积','43.2','%','40.0-50.0','正常'),
('平均红细胞体积','90.4','fL','82.0-100.0','正常'),('血小板','236','10^9/L','125-350','正常'),
('中性粒细胞比例','58.0','%','40.0-75.0','正常'),('淋巴细胞比例','32.0','%','20.0-50.0','正常')],
['本组模拟血常规指标均位于所列示例参考范围内。']),
('肝功能', '静脉血清', [
('丙氨酸氨基转移酶 ALT','58','U/L','9-50','偏高'),('天门冬氨酸氨基转移酶 AST','35','U/L','15-40','正常'),
('碱性磷酸酶 ALP','82','U/L','45-125','正常'),('γ-谷氨酰转移酶 GGT','66','U/L','10-60','偏高'),
('总胆红素','12.8','μmol/L','0-21','正常'),('直接胆红素','3.2','μmol/L','0-7','正常'),
('白蛋白','44.6','g/L','40-55','正常'),('总蛋白','72.5','g/L','65-85','正常')],
['ALT及GGT轻度升高，其余所列项目在示例参考范围内。','与第09份腹部超声的模拟肝脏描述配套，不能据此单独确定病因。']),
('肾功能与电解质', '静脉血清', [
('肌酐','84','μmol/L','57-97','正常'),('尿素','5.2','mmol/L','3.1-8.0','正常'),
('尿酸','452','μmol/L','208-428','偏高'),('钠','140','mmol/L','137-147','正常'),
('钾','4.2','mmol/L','3.5-5.3','正常'),('氯','103','mmol/L','99-110','正常'),
('总钙','2.31','mmol/L','2.11-2.52','正常')],
['尿酸高于所列示例参考范围；其余所列指标在范围内。']),
('血脂检查', '空腹静脉血清', [
('总胆固醇','5.65','mmol/L','<5.20','偏高'),('甘油三酯','2.18','mmol/L','<1.70','偏高'),
('高密度脂蛋白胆固醇','0.94','mmol/L','>=1.00','偏低'),('低密度脂蛋白胆固醇','3.62','mmol/L','<3.40','偏高')],
['模拟结果显示多项血脂指标异常。','表中为测试用一般判读界值，不是针对个人风险制定的治疗目标。']),
('空腹血糖与糖化血红蛋白', '空腹静脉血浆及EDTA全血', [
('空腹血糖','6.2','mmol/L','3.9-6.1','偏高'),('糖化血红蛋白 HbA1c','6.0','%','4.0-6.0','范围上限')],
['空腹血糖略高于所列示例参考范围，HbA1c处于范围上限。','本模拟报告不作为糖尿病诊断依据。']),
('尿常规', '晨尿 / 中段尿', [
('颜色','淡黄色','-','淡黄色','正常'),('透明度','清亮','-','清亮','正常'),
('尿比重','1.020','-','1.005-1.030','正常'),('pH','6.0','-','4.5-8.0','正常'),
('尿蛋白','阴性','-','阴性','正常'),('尿糖','阴性','-','阴性','正常'),
('尿潜血','阴性','-','阴性','正常'),('亚硝酸盐','阴性','-','阴性','正常'),
('白细胞','0-2','/HPF','0-5','正常'),('红细胞','0-1','/HPF','0-3','正常')],
['本组模拟尿常规未见所列项目异常。']),
('甲状腺功能', '静脉血清', [
('促甲状腺激素 TSH','2.36','mIU/L','0.27-4.20','正常'),('游离三碘甲状腺原氨酸 FT3','4.8','pmol/L','3.1-6.8','正常'),
('游离甲状腺素 FT4','15.2','pmol/L','12.0-22.0','正常')],
['所列模拟甲状腺功能指标位于示例参考范围内。']),
('十二导联心电图', '静息十二导联 / 25 mm/s / 10 mm/mV', [
('心率','76','次/分','60-100','正常'),('PR间期','160','ms','120-200','正常'),
('QRS时限','90','ms','<120','正常'),('QT/QTc','370/416','ms','QTc示例范围<450','正常'),
('QRS电轴','+52','度','-30至+90','正常')],
['模拟所见：窦性心律，节律规则；未设定明显ST-T异常。','模拟结论：窦性心律。本页仅为文字报告，不含真实心电波形。']),
('腹部超声', '肝、胆、胰、脾、双肾 / 空腹检查', None,
['检查所见：','肝脏大小未设定明显异常，包膜光整；实质回声弥漫性增强，深部回声轻度衰减。',
 '肝内血管显示稍欠清晰，未设定局灶性占位；肝内外胆管未见扩张。',
 '胆囊壁不厚，腔内未设定结石样强回声；胰腺可见部分及脾脏未见明显异常。',
 '双肾大小、形态及实质回声未设定明显异常；集合系统未见分离。',
 '模拟影像结论：肝脏弥漫性回声改变，倾向轻度脂肪肝表现。',
 '本页为虚构的影像文字报告，不附超声图像。']),
('胸部X线', '胸部正位 / 数字化摄影', None,
['检查所见：','双肺透亮度尚可，肺纹理未设定明显增多；未设定局灶性实变影。',
 '心影大小未设定明显异常，纵隔未见明显增宽。',
 '双侧肋膈角锐利，未设定胸腔积液或气胸征象。',
 '模拟影像结论：胸部正位片未设定明显异常。',
 '本页为虚构的影像文字报告，不附X线图像。'])
]

def text(c, x, y, value, size=11, color='#243b3a'):
    c.setFillColor(HexColor(color)); c.setFont(FONT, size); c.drawString(x,y,value)

def wrap(value, width=43):
    return [value[i:i+width] for i in range(0,len(value),width)]

if len(sys.argv) > 1:
    reports = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    OUT = Path('output/pdf/模拟癌症患者报告')
    OUT.mkdir(parents=True, exist_ok=True)
count = len(reports)
cancer = count == 11
paths=[]
for i,(title,specimen,rows,notes) in enumerate(reports,1):
    path=OUT/f'{i:02d}_{title}_模拟.pdf'; paths.append(path)
    c=canvas.Canvas(str(path),pagesize=(595.28,841.89))
    c.setTitle(f'模拟病例报告 {i:02d} - {title}')
    c.setAuthor('CaseMate 测试数据')
    c.setFillColor(HexColor('#174d48')); c.rect(0,755,595.28,86,fill=1,stroke=0)
    text(c,40,807,'CASEMATE / 虚构检查报告',12,'#ffffff')
    text(c,40,776,title,23,'#ffffff')
    text(c,40,731,'模拟数据 · 仅供软件测试 · 非真实医疗文书',12,'#b45309')
    text(c,40,702,'患者：测试患者A（虚构）    性别：男    年龄：38岁')
    text(c,40,680,'测试患者编号：ONCO-DEMO-001    场景：肺癌诊疗资料模拟' if cancer else '测试患者编号：DEMO-001    场景：年度体检')
    text(c,40,658,f'检查日期：2026-10-10    报告日期：2026-10-11    编号：SIM-{i:02d}')
    text(c,40,636,f'标本 / 检查方式：{specimen}',10)
    y=596
    if rows:
        cols=[40,246,327,405,513]
        c.setFillColor(HexColor('#e8f1ef')); c.rect(35,y-10,525,29,fill=1,stroke=0)
        for x,v in zip(cols,['检查项目','结果','单位','示例参考范围','标记']):text(c,x,y,v,10)
        y-=37
        for row in rows:
            for x,v in zip(cols,row):text(c,x,y,v,9.5,'#b45309' if row[-1] in ('偏高','偏低') else '#243b3a')
            c.setStrokeColor(HexColor('#e2e8e5'));c.line(35,y-10,560,y-10)
            y-=31
        y-=24
        text(c,40,y,'模拟结果摘要',12); y-=26
    else:
        text(c,40,y,'检查描述与模拟结论',13);y-=32
    for note in notes:
        for line in wrap(note):text(c,40,y,line,11);y-=23
        y-=7
    c.setStrokeColor(HexColor('#cbd5d1'));c.line(40,126,555,126)
    for j,line in enumerate(['全部身份、数值和结论均为人为编造，未采集真实患者资料。',
                             '参考范围仅为测试示例，实际范围依实验室、方法和患者情况而异。',
                             '无真实医院、医师签名或印章；不得用于诊断、用药、报销或证明。']):
        text(c,40,107-j*18,line,9,'#61746f')
    text(c,40,35,'可提取文字的PDF / 适用于上传与检索测试',9,'#61746f')
    text(c,503,35,f'{i:02d} / {count}',9,'#61746f')
    c.showPage();c.save()

combined=OUT.parent/('模拟癌症患者_检查报告及诊断书_合并版.pdf' if cancer else '模拟患者_10份检查报告_合并版.pdf')
writer=PdfWriter()
for path in paths:
    reader=PdfReader(path)
    assert len(reader.pages)==1
    extracted=reader.pages[0].extract_text()
    assert '测试患者A' in extracted and '模拟' in extracted
    writer.append(reader)
with combined.open('wb') as f:writer.write(f)
with zipfile.ZipFile(OUT.parent/('模拟癌症患者_11份独立PDF.zip' if cancer else '模拟病例报告_10份独立PDF.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for path in paths:z.write(path,path.name)
assert len(PdfReader(combined).pages)==count
print(f'Created {count} single-page PDFs, combined PDF, and ZIP. Chinese text extraction verified.')
