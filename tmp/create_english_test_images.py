from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap

OUT = Path(r'H:\IXDS754\IXDS754-Backend\test image')
OUT.mkdir(exist_ok=True)
FONT = r'C:\Windows\Fonts\arial.ttf'
BOLD = r'C:\Windows\Fonts\arialbd.ttf'
GREEN = '#214D3D'
reports = [
('01_EN_Complete_Blood_Count.png','Complete Blood Count','2026-06-26',[
 ('White blood cells','6.20','10^9/L','4.00 - 10.00','Normal'),
 ('Neutrophils','3.70','10^9/L','2.00 - 7.00','Normal'),
 ('Hemoglobin','112','g/L','130 - 175','Low'),
 ('Platelets','220','10^9/L','150 - 400','Normal'),
 ('Red blood cells','3.92','10^12/L','4.30 - 5.80','Low'),
 ('Hematocrit','34.1','%','40.0 - 50.0','Low')],
 [('Specimen','Venous blood. Collection date: 2026-06-26.'),('Report note','Results and reference intervals are fictional examples for software testing.')]),
('02_EN_Followup_Blood_Count.png','Follow-up Complete Blood Count','2026-07-06',[
 ('White blood cells','5.80','10^9/L','4.00 - 10.00','Normal'),
 ('Neutrophils','3.40','10^9/L','2.00 - 7.00','Normal'),
 ('Hemoglobin','109','g/L','130 - 175','Low'),
 ('Platelets','185','10^9/L','150 - 400','Normal'),
 ('Red blood cells','3.80','10^12/L','4.30 - 5.80','Low')],
 [('Specimen','Venous blood. Collection date: 2026-07-06.'),('Comparison','Previous hemoglobin: 112 g/L on 2026-06-26. Current: 109 g/L. Previous platelets: 220 x10^9/L; current: 185 x10^9/L. These changes alone do not establish clinical improvement or deterioration.')]),
('03_EN_Liver_Kidney_Function.png','Liver and Kidney Function','2026-07-06',[
 ('ALT','62','U/L','7 - 40','High'),('AST','45','U/L','13 - 35','High'),
 ('Albumin','33.1','g/L','35.0 - 50.0','Low'),('Total bilirubin','12.0','umol/L','5.0 - 21.0','Normal'),
 ('Creatinine','78','umol/L','59 - 104','Normal'),('Urea','5.2','mmol/L','2.9 - 8.2','Normal')],
 [('Specimen','Serum. Collection date: 2026-07-06.'),('Report note','Reference intervals are illustrative laboratory ranges, not universal clinical thresholds.')]),
('04_EN_Electrolytes_Coagulation.png','Electrolytes and Coagulation','2026-07-06',[
 ('Sodium','139','mmol/L','135 - 145','Normal'),('Potassium','4.1','mmol/L','3.5 - 5.1','Normal'),
 ('Calcium','2.25','mmol/L','2.10 - 2.55','Normal'),('PT','12.4','s','10.0 - 14.0','Normal'),
 ('INR','1.05','ratio','0.80 - 1.20','Normal'),('APTT','31.0','s','25.0 - 35.0','Normal')],
 [('Specimen','Serum for electrolytes; citrated plasma for coagulation.'),('Report note','Synthetic test results. No medication or treatment decision is provided.')]),
('05_EN_Tumor_Markers.png','Tumor Marker Panel','2026-07-08',[
 ('CEA','8.2','ng/mL','0.0 - 5.0','High'),('CYFRA 21-1','4.1','ng/mL','0.0 - 3.3','High'),
 ('NSE','12.6','ng/mL','0.0 - 16.3','Normal')],
 [('Specimen','Serum. Collection date: 2026-07-08.'),('Interpretation in source','Tumor markers alone do not establish a diagnosis or stage. Interpret with the documented imaging and pathology findings.')]),
('06_EN_Chest_CT.png','Contrast-enhanced Chest CT','2026-07-10',[],[
 ('Examination','Chest CT with intravenous contrast.'),
 ('Findings','An irregular lesion in the right upper lobe measures 32 x 24 mm. A right paratracheal lymph node measures 12 mm in short axis. No pleural effusion is seen.'),
 ('Impression','Right upper lobe lesion suspicious for malignancy. The enlarged lymph node is indeterminate. Pathological confirmation is required.'),
 ('Comparison','No previous CT is available in this fictional source. No imaging response category is assigned.')]),
('07_EN_Abdominal_CT.png','Contrast-enhanced Abdominal CT','2026-07-11',[],[
 ('Examination','CT of the abdomen and pelvis with intravenous contrast.'),
 ('Findings','A 7 mm low-density focus is present in hepatic segment VI and is too small to characterize. No enlarged abdominal lymph nodes are identified. No ascites is present.'),
 ('Impression','Small indeterminate hepatic focus. No definite abdominal metastatic lesion is established by this examination.'),
 ('Source qualifier','Indeterminate does not mean confirmed metastasis. Preserve this wording during extraction.')]),
('08_EN_Brain_MRI.png','Contrast-enhanced Brain MRI','2026-07-12',[],[
 ('Examination','Brain MRI before and after intravenous contrast.'),
 ('Findings','No intracranial mass or abnormal enhancing lesion is identified. Ventricular size is within normal limits. No acute diffusion restriction is seen.'),
 ('Impression','No imaging evidence of intracranial metastasis on this examination.'),
 ('Report note','This is a fictional written imaging report. No actual MRI images are included.')]),
('09_EN_Pathology_Molecular.png','Lung Biopsy and Molecular Results','2026-07-15',[],[
 ('Specimen','Core needle biopsy of the right upper lobe lesion; collected 2026-07-13.'),
 ('Histological diagnosis','Lung adenocarcinoma, moderately differentiated.'),
 ('Immunohistochemistry','TTF-1: positive. Napsin A: positive. p40: negative. PD-L1 TPS: 10%.'),
 ('Molecular testing','EGFR exon 19 deletion detected. ALK rearrangement not detected.'),
 ('Limitations','Tumor stage cannot be determined from this biopsy specimen alone. All findings are fictional software-test data.')]),
('10_EN_Physician_Diagnosis_Note.png','Physician Diagnosis Summary','2026-07-16',[],[
 ('Patient presentation','Fictional patient reports persistent cough. The source records contain chest CT, abdominal CT, brain MRI, blood tests and a lung biopsy.'),
 ('Documented diagnosis','Right upper lobe lung adenocarcinoma, supported by biopsy dated 2026-07-15.'),
 ('Stage status','Clinical stage is not yet finalized. The mediastinal lymph node and hepatic focus remain indeterminate. No TNM category is assigned in this note.'),
 ('Treatment history','No surgery, chemotherapy, radiotherapy or targeted treatment has started as of 2026-07-16.'),
 ('Source summary','Hemoglobin: 109 g/L and platelets: 185 x10^9/L on 2026-07-06. EGFR exon 19 deletion detected. PD-L1 TPS: 10%.'),
 ('Document status','Synthetic physician-note example only. No real clinician name, signature, prescription or hospital endorsement.')])
]

def font(size,bold=False): return ImageFont.truetype(BOLD if bold else FONT,size)
for index,(name,title,date,rows,sections) in enumerate(reports,1):
    im=Image.new('RGB',(1800,2400),'#FAFCFA'); d=ImageDraw.Draw(im)
    d.rectangle((0,0,1800,245),fill=GREEN)
    d.text((95,48),'CASEMATE / SYNTHETIC MEDICAL RECORD',font=font(28),fill='white')
    for j,line in enumerate(textwrap.wrap(title,44)):
        d.text((95,100+j*59),line,font=font(48,True),fill='white')
    d.rounded_rectangle((90,280,1710,356),radius=12,fill='#F4E5D4')
    d.text((115,303),'FICTIONAL TEST DATA - NOT A REAL MEDICAL DOCUMENT',font=font(28,True),fill='#80592F')
    metadata=[('Patient','Test Patient A (fictional)'),('Sex / Age','Male / 58 years'),('Patient ID','EN-TEST-001'),('Report date',date),('Document ID',f'EN-SIM-{index:03d}')]
    y=400
    for key,value in metadata:
        d.text((100,y),key+':',font=font(29,True),fill=GREEN)
        d.text((415,y),value,font=font(29),fill='#263C33');y+=49
    y+=30
    if rows:
        d.rectangle((90,y,1710,y+68),fill='#DCE8DE')
        cols=[110,640,850,1110,1530]
        for x,t in zip(cols,['Test / Indicator','Result','Unit','Reference range','Flag']):d.text((x,y+19),t,font=font(25,True),fill=GREEN)
        y+=68
        for row in rows:
            d.rectangle((90,y,1710,y+76),fill='white')
            d.line((90,y+75,1710,y+75),fill='#D5DFD7',width=2)
            for x,t in zip(cols,row): d.text((x,y+23),t,font=font(25),fill='#A14334' if row[-1] in ['Low','High'] else '#263C33')
            y+=76
        y+=35
    for label,body in sections:
        d.text((100,y),label,font=font(30,True),fill=GREEN);y+=49
        for line in textwrap.wrap(body,width=91):
            d.text((100,y),line,font=font(28),fill='#263C33');y+=42
        y+=28
    assert y<2230,(name,y)
    d.line((90,2260,1710,2260),fill='#CBD8CE',width=2)
    d.text((100,2290),'Software testing only | No real patient or clinician | Verify OCR against this image',font=font(23),fill='#6D8073')
    d.text((100,2330),f'Document {index:02d} / 10 | English OCR and account-record retrieval test',font=font(23),fill='#6D8073')
    im.save(OUT/name,optimize=True)
    print(name)

# Disposable contact sheet for visual verification; not part of delivered ten files.
sheet=Image.new('RGB',(1500,1000),'#E7EEE7')
for i,(name,*_) in enumerate(reports):
    thumb=Image.open(OUT/name);thumb.thumbnail((280,390))
    x=(i%5)*300+10;y=(i//5)*500+10
    sheet.paste(thumb,(x,y))
    ImageDraw.Draw(sheet).text((x,y+400),name[:25],font=font(15),fill=GREEN)
sheet.save('tmp/english-test-contact-sheet.png')
