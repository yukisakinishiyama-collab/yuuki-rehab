"""架空のDICOM（MRI 2シリーズ＋X線2枚）を作る。テスト用。氏名などもすべて架空。"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

MR = "1.2.840.10008.5.1.4.1.1.4"
CR = "1.2.840.10008.5.1.4.1.1.1"


def _base(sop: str, study: str, series: str, modality: str, desc: str, num: int, inst: int):
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = sop
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = FileDataset("x", {}, file_meta=meta, preamble=b"\0" * 128)
    ds.SOPClassUID, ds.SOPInstanceUID = sop, meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID, ds.SeriesInstanceUID = study, series
    ds.SpecificCharacterSet = "ISO_IR 192"
    ds.PatientName = "TEST^HANAKO=試験^花子"
    ds.PatientID = "0099887766"
    ds.PatientBirthDate = "20171115"
    ds.PatientSex = "F"
    ds.PatientWeight = "27"
    ds.InstitutionName = "架空病院"
    ds.StudyDate = ds.SeriesDate = "20261027"
    ds.StudyTime = ds.SeriesTime = "103100" if modality == "MR" else "092900"
    ds.Modality, ds.SeriesDescription, ds.SeriesNumber, ds.InstanceNumber = modality, desc, num, inst
    ds.Manufacturer, ds.ManufacturerModelName = ("Canon", "Gracian") if modality == "MR" else ("KONICA MINOLTA", "CS-7")
    ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
    ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 12, 11, 0
    return ds


def _phantom(n: int, k: int, bright: bool) -> np.ndarray:
    yy, xx = np.mgrid[:n, :n]
    a = np.zeros((n, n), np.float32)
    a[((yy - n * 0.5) ** 2 + (xx - n * 0.5) ** 2) < (n * 0.42) ** 2] = 300        # 軟部
    a[((yy - n * 0.4) ** 2 + (xx - n * 0.45) ** 2) < (n * 0.16) ** 2] = 900 if not bright else 250   # 骨
    a[((yy - n * 0.68) ** 2 + (xx - n * 0.5) ** 2) < (n * 0.12) ** 2] = 800 if not bright else 220
    if bright and 3 <= k <= 5:                                                      # 液体（数枚にだけ）
        a[int(n * 0.52):int(n * 0.56), int(n * 0.28):int(n * 0.36)] = 1500
    rng = np.random.default_rng(k)
    return np.clip(a + rng.normal(0, 12, a.shape), 0, 4095).astype(np.uint16)


def make(out: Path, n: int = 128, slices: int = 8) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    study = generate_uid()
    for num, (desc, bright) in enumerate((("Rt-sag-t2-stir", True), ("Rt-sag-t1", False)), start=2):
        series = generate_uid()
        for k in range(slices):
            ds = _base(MR, study, series, "MR", desc, num, k + 1)
            ds.Rows = ds.Columns = n
            ds.PixelSpacing = [0.5, 0.5]
            ds.SliceThickness = 3.0
            ds.ImageOrientationPatient = [0, 1, 0, 0, 0, -1]      # 矢状断：画面右＝後方、画面下＝足側
            ds.ImagePositionPatient = [-20 + 3.6 * k, -32, 32]
            ds.RepetitionTime, ds.EchoTime = ("5891", "81") if bright else ("380", "8.5")
            if bright:
                ds.InversionTime = "140"
            ds.MagneticFieldStrength = "1.5"
            ds.PixelData = _phantom(n, k, bright).tobytes()
            ds.save_as(out / f"MR{num}_{k + 1:03d}", enforce_file_format=True)
    study2 = generate_uid()
    series = generate_uid()
    for i, view in enumerate(("AP", "LAT"), start=1):
        ds = _base(CR, study2, series, "CR", "ANKLE R", 1, i)
        ds.Rows = ds.Columns = 160
        ds.ImagerPixelSpacing = [0.175, 0.175]
        ds.ViewPosition, ds.KVP, ds.ImageLaterality = view, "45", "R"
        ds.PixelData = _phantom(160, i, False).tobytes()
        ds.save_as(out / f"CR_{i:03d}", enforce_file_format=True)
    (out / "DICOMDIR").write_bytes(b"x")
    (out / "viewer.exe").write_bytes(b"x")
    return out


if __name__ == "__main__":
    print(make(Path(sys.argv[1])))
