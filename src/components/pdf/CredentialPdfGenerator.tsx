'use client';

import { pdf } from '@react-pdf/renderer';
import { StudentCredentialsPdf } from './StudentCredentialsPdf';
import { TeacherCredentialsPdf } from './TeacherCredentialsPdf';
import { MissionOrderPdf } from './MissionOrderPdf';
import { AttestationPdf } from './AttestationPdf';
import { ConventionPdf } from './ConventionPdf';
import { Student, Teacher, ClassDefinition } from '@/store/school';
import { MissionOrder } from '@/store/missionOrder';
import { Convention } from '@/store/convention';
import React from 'react';

export async function generateStudentCredentialsBlob(students: Student[], classInfo: ClassDefinition, schoolName: string) {
    return await pdf(<StudentCredentialsPdf students={students} classInfo={classInfo} schoolName={schoolName} />).toBlob();
}

export async function generateTeacherCredentialsBlob(teachers: Teacher[], classInfo: ClassDefinition, schoolName: string) {
    return await pdf(<TeacherCredentialsPdf teachers={teachers} className={classInfo.name} schoolName={schoolName} />).toBlob();
}

export async function generateMissionOrderBlob(missionOrder: MissionOrder, convention: Convention, qrCodeUrl?: string) {
    return await pdf(<MissionOrderPdf missionOrder={missionOrder} convention={convention} qrCodeUrl={qrCodeUrl} />).toBlob();
}

export async function generateAttestationBlob(convention: Convention, totalAbsenceHours: number, qrCodeUrl?: string, hashCode?: string) {
    return await pdf(<AttestationPdf convention={convention} totalAbsenceHours={totalAbsenceHours} qrCodeUrl={qrCodeUrl} hashCode={hashCode} />).toBlob();
}

export async function generateConventionBlob(data: Partial<Convention>, qrCodeUrl?: string, hashCode?: string) {
    return await pdf(<ConventionPdf data={data} qrCodeUrl={qrCodeUrl} hashCode={hashCode} />).toBlob();
}
