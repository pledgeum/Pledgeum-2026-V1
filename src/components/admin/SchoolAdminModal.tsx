'use client';

import { useState, useRef } from 'react';
import { X, UserPlus, Trash2, Users, Briefcase, GraduationCap, Upload, FileUp, Sparkles, Building, Shield, ShieldAlert, Lock } from 'lucide-react';
import { useSchoolStore, COLLABORATOR_LABELS, CollaboratorRole, Teacher, Student } from '@/store/school';
import { useUserStore } from '@/store/user';
import Papa from 'papaparse';

interface SchoolAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}

import { useMemo } from 'react'; // Add useMemo

export function SchoolAdminModal({ isOpen, onClose }: SchoolAdminModalProps) {
    const [activeTab, setActiveTab] = useState<'collaborators' | 'classes' | 'config' | 'identity'>('identity');
    const { collaborators, classes, addCollaborator, removeCollaborator, addClass, removeClass, updateClass, importTeachers, addTeacherToClass, removeTeacherFromClass, importStudents, addStudentToClass, removeStudentFromClass, allowedConventionTypes, toggleConventionType, schoolHeadEmail, delegatedAdminId, setDelegatedAdmin, schoolName, schoolAddress, schoolPhone, schoolHeadName } = useSchoolStore();
    const { email } = useUserStore();

    // Permissions
    const isSchoolHead = email && schoolHeadEmail && email.toLowerCase() === schoolHeadEmail.toLowerCase();
    const isDelegatedAdmin = email && collaborators.some(c => c.id === delegatedAdminId && c.email.toLowerCase() === email.toLowerCase());

    const canEditIdentity = isSchoolHead || isDelegatedAdmin || (schoolHeadEmail === "");
    const canDelegate = isSchoolHead || (schoolHeadEmail === "");


    // Validation Logic
    const missingIdentity = useMemo(() => {
        return !schoolName || !schoolAddress || !schoolPhone || !schoolHeadName || !schoolHeadEmail;
    }, [schoolName, schoolAddress, schoolPhone, schoolHeadName, schoolHeadEmail]);

    const missingClasses = useMemo(() => {
        if (classes.length === 0) return true;
        // Requirement: "At least one class, with the main teacher"
        // Check if there is at least one class that has a main teacher assigned.
        // In store/school.ts, Class interface has `mainTeachers` (string, likely ID).
        const hasBroadMainTeacher = classes.some(c => c.mainTeachers && c.mainTeachers.trim() !== '');
        return !hasBroadMainTeacher;
    }, [classes]);

    const missingConfig = useMemo(() => {
        return !allowedConventionTypes || allowedConventionTypes.length === 0;
    }, [allowedConventionTypes]);


    // Form States
    const [newCollab, setNewCollab] = useState({ name: '', email: '', role: 'DDFPT' as CollaboratorRole });
    const [newClass, setNewClass] = useState({ name: '', mainTeachers: '', cpes: '' });

    // Teacher Management State
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
    const [newTeacher, setNewTeacher] = useState({ firstName: '', lastName: '', email: '' });
    const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', email: '' }); // New Student State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const studentFileInputRef = useRef<HTMLInputElement>(null); // New Ref

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const teachers: Omit<Teacher, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const lastName = row['Nom'] || row['nom'];
                    const firstName = row['Prénom'] || row['prenom'] || row['Prenom'];
                    const email = row['Email'] || row['email'] || row['Courriel'] || row['courriel'];
                    if (lastName && firstName && email) teachers.push({ firstName, lastName, email });
                });

                if (teachers.length > 0) {
                    importTeachers(classId, teachers);
                    alert(`${teachers.length} enseignants importés avec succès.`);
                } else {
                    alert("Aucun enseignant valide trouvé dans le CSV. Vérifiez les colonnes (Nom, Prénom, Email).");
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => { console.error("CSV Import Error:", error); alert("Erreur lors de l'import CSV."); }
        });
    };

    const handleImportStudentCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const students: Omit<Student, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const lastName = row['Nom'] || row['nom'];
                    const firstName = row['Prénom'] || row['prenom'] || row['Prenom'];
                    const email = row['Email'] || row['email'] || row['Courriel'] || row['courriel'];
                    if (lastName && firstName && email) students.push({ firstName, lastName, email });
                });

                if (students.length > 0) {
                    importStudents(classId, students);
                    alert(`${students.length} élèves importés avec succès.`);
                } else {
                    alert("Aucun élève valide trouvé dans le CSV. Vérifiez les colonnes (Nom, Prénom, Email).");
                }
                if (studentFileInputRef.current) studentFileInputRef.current.value = '';
            },
            error: (error) => { console.error("CSV Import Error:", error); alert("Erreur lors de l'import CSV."); }
        });
    };

    const handleAutoPopulate = (classId: string) => {
        const dummyTeachers: Omit<Teacher, 'id'>[] = [
            { firstName: 'Alice', lastName: 'Dupont', email: 'alice.dupont@test.com' },
            { firstName: 'Bob', lastName: 'Martin', email: 'bob.martin@test.com' },
            { firstName: 'Charlie', lastName: 'Durand', email: 'charlie.durand@test.com' },
            { firstName: 'David', lastName: 'Leroy', email: 'david.leroy@test.com' },
            { firstName: 'Eva', lastName: 'Moreau', email: 'eva.moreau@test.com' }
        ];
        importTeachers(classId, dummyTeachers);

        // Also populate dummy students for testing
        const dummyStudents: Omit<Student, 'id'>[] = [
            { firstName: 'Student1', lastName: 'A', email: 'student1@test.com' },
            { firstName: 'Student2', lastName: 'B', email: 'student2@test.com' },
            { firstName: 'Student3', lastName: 'C', email: 'student3@test.com' }
        ];
        importStudents(classId, dummyStudents);
    };

    const handleAddTeacher = (e: React.FormEvent, classId: string) => {
        e.preventDefault();
        if (newTeacher.firstName && newTeacher.lastName && newTeacher.email) {
            addTeacherToClass(classId, newTeacher);
            setNewTeacher({ firstName: '', lastName: '', email: '' });
        }
    };

    const handleAddStudent = (e: React.FormEvent, classId: string) => {
        e.preventDefault();
        if (newStudent.firstName && newStudent.lastName && newStudent.email) {
            addStudentToClass(classId, newStudent);
            setNewStudent({ firstName: '', lastName: '', email: '' });
        }
    };

    const handleAddCollaborator = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCollab.name && newCollab.email) {
            addCollaborator(newCollab);
            setNewCollab({ name: '', email: '', role: 'DDFPT' });
        }
    };

    const handleAddClass = (e: React.FormEvent) => {
        e.preventDefault();
        if (newClass.name) {
            addClass({ ...newClass, teachersList: [], studentsList: [] });
            setNewClass({ name: '', mainTeachers: '', cpes: '' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <Briefcase className="w-6 h-6" />
                        <div>
                            <h3 className="text-xl font-bold">Administration Établissement</h3>
                            <p className="text-xs text-blue-200">Gérez vos équipes et vos classes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('identity')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'identity' ? 'text-orange-900 border-b-2 border-orange-900 bg-orange-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Building className="w-4 h-4" />
                        <span>Identité Établissement</span>
                        {missingIdentity && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Données manquantes"></span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('collaborators')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'collaborators' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" />
                        <span>Collaborateurs</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'classes' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        <span>Classes & Professeurs</span>
                        {missingClasses && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Au moins une classe avec Prof. Principal requise"></span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'config' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Choix des conventions</span>
                        {missingConfig && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Au moins un type de convention requis"></span>}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    {activeTab === 'collaborators' ? (
                        <div className="space-y-8">
                            {/* ... (Collaborators Content) ... */}
                            {/* Add Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                    <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                                    Ajouter un collaborateur
                                </h4>
                                <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                                        <select
                                            value={newCollab.role}
                                            onChange={(e) => setNewCollab({ ...newCollab, role: e.target.value as CollaboratorRole })}
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            {Object.entries(COLLABORATOR_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom Complet</label>
                                        <input
                                            type="text"
                                            value={newCollab.name}
                                            onChange={(e) => setNewCollab({ ...newCollab, name: e.target.value })}
                                            placeholder="Ex: Jean Dupont"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Email Académique</label>
                                        <input
                                            type="email"
                                            value={newCollab.email}
                                            onChange={(e) => setNewCollab({ ...newCollab, email: e.target.value })}
                                            placeholder="jean.dupont@ac-..."
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors h-[38px]"
                                    >
                                        Ajouter
                                    </button>
                                </form>
                            </div>

                            {/* List */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Équipe actuelle ({collaborators.length})</h4>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                                    {collaborators.length === 0 ? (
                                        <p className="p-4 text-sm text-gray-500 text-center italic">Aucun collaborateur ajouté.</p>
                                    ) : (
                                        collaborators.map((collab) => (
                                            <div key={collab.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center space-x-4">
                                                    <div className="bg-blue-100 p-2 rounded-full">
                                                        <Users className="w-4 h-4 text-blue-700" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{collab.name}</p>
                                                        <p className="text-xs text-gray-500">{collab.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-6">
                                                    {delegatedAdminId === collab.id ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200" title="Ce collaborateur a les droits d'ajout des équipes et structures">
                                                            <Shield className="w-3 h-3 mr-1" />
                                                            Droits d'ajout des équipes et structures
                                                            {canDelegate && (
                                                                <button onClick={() => setDelegatedAdmin(null)} className="ml-2 text-green-600 hover:text-green-900">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        canDelegate && (
                                                            <button
                                                                onClick={() => setDelegatedAdmin(collab.id)}
                                                                className="flex items-center text-gray-400 hover:text-purple-600 transition-colors text-xs"
                                                                title="Déléguer la gestion établissement"
                                                            >
                                                                <Shield className="w-4 h-4 mr-1" />
                                                                Déléguer la gestion établissement
                                                            </button>
                                                        )
                                                    )}
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {COLLABORATOR_LABELS[collab.role]}
                                                    </span>
                                                    <button
                                                        onClick={() => removeCollaborator(collab.id)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'classes' ? (
                        // ... (Classes Content - Simplified for Brevity in logic, but re-rendered completely if I replace the whole block)
                        // Wait, I should not replace the whole block if I can avoid it.
                        // But I need to handle the ELSE logic for the new tab.
                        // I'll try to target the END of the `activeTab === 'classes'` block and insert the ELSE IF for 'identity'.
                        // Actually, I can use `activeTab` render logic more cleaner.
                        <div className="space-y-8">
                            {/* ... Classes content ... (omitted for brevity in replacement if I target strictly) */}
                            {/* Add Class Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                {/* ... content ... */}
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                    <GraduationCap className="w-4 h-4 mr-2 text-green-600" />
                                    Ajouter une classe
                                </h4>
                                <form onSubmit={handleAddClass} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la classe</label>
                                        <input
                                            type="text"
                                            value={newClass.name}
                                            onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                                            placeholder="Ex: 2nde Bac Pro 1"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Professeurs Principaux</label>
                                        <input
                                            type="text"
                                            value={newClass.mainTeachers}
                                            onChange={(e) => setNewClass({ ...newClass, mainTeachers: e.target.value })}
                                            placeholder="Ex: M. Dupont, Mme Martin"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">CPE Référents</label>
                                        <input
                                            type="text"
                                            value={newClass.cpes}
                                            onChange={(e) => setNewClass({ ...newClass, cpes: e.target.value })}
                                            placeholder="Ex: Mme Durand"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors h-[38px]"
                                    >
                                        Ajouter
                                    </button>
                                </form>
                            </div>

                            {/* Classes List */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Liste des classes ({classes.length})</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {classes.length === 0 ? (
                                        <div className="col-span-full p-8 text-center bg-white rounded-lg border border-gray-200 text-gray-500 italic">
                                            Aucune classe configurée.
                                        </div>
                                    ) : (
                                        classes.map((cls) => (
                                            <div key={cls.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative group transition-all duration-200">
                                                <button
                                                    onClick={() => removeClass(cls.id)}
                                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <div className="flex justify-between items-center mb-2">
                                                    <h5 className="font-bold text-gray-900 text-lg cursor-pointer hover:text-blue-600 flex items-center" onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}>
                                                        {cls.name}
                                                    </h5>
                                                    <button
                                                        onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                                                        className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 font-medium transition-colors border border-blue-200"
                                                    >
                                                        {expandedClassId === cls.id ? 'Masquer vivier' : `Gérer vivier (${cls.teachersList?.length || 0})`}
                                                    </button>
                                                </div>
                                                <div className="space-y-2 mb-4">
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Professeurs Principaux</span>
                                                        <p className="text-sm text-gray-800 break-words">{cls.mainTeachers || 'Non assigné'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CPE</span>
                                                        <p className="text-sm text-gray-800 break-words">{cls.cpes || 'Non assigné'}</p>
                                                    </div>
                                                </div>

                                                {/* Teacher Management Section */}
                                                <div className={`border-t border-gray-100 pt-3 ${expandedClassId === cls.id ? 'block' : 'hidden'}`}>
                                                    <h6 className="text-sm font-bold text-gray-900 mb-2 flex items-center justify-between">
                                                        Vivier Enseignants
                                                        <div className="flex space-x-2">
                                                            {/* Test Account Auto-Populate Button */}
                                                            {email === 'pledgeum@gmail.com' && (
                                                                <button
                                                                    onClick={() => handleAutoPopulate(cls.id)}
                                                                    className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded flex items-center border border-indigo-200"
                                                                    title="Générer 5 enseignants fictifs (Mode Test)"
                                                                >
                                                                    <Sparkles className="w-3 h-3 mr-1" /> Auto-Test
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center"
                                                                title="Import CSV (Nom, Prénom, Email)"
                                                            >
                                                                <FileUp className="w-3 h-3 mr-1" /> Import CSV
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                onChange={(e) => handleImportCSV(e, cls.id)}
                                                                className="hidden"
                                                                accept=".csv"
                                                            />
                                                        </div>
                                                    </h6>

                                                    {/* Add Teacher Form */}
                                                    <form onSubmit={(e) => handleAddTeacher(e, cls.id)} className="grid grid-cols-7 gap-2 mb-3">
                                                        <input
                                                            placeholder="Nom"
                                                            value={newTeacher.lastName}
                                                            onChange={e => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Prénom"
                                                            value={newTeacher.firstName}
                                                            onChange={e => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Email"
                                                            type="email"
                                                            value={newTeacher.email}
                                                            onChange={e => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <button type="submit" className="col-span-1 bg-blue-600 text-white rounded flex items-center justify-center hover:bg-blue-700">
                                                            <UserPlus className="w-3 h-3" />
                                                        </button>
                                                    </form>

                                                    {/* Teachers List */}
                                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                                        {cls.teachersList && cls.teachersList.length > 0 ? (
                                                            cls.teachersList.map(teacher => (
                                                                <div key={teacher.id} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs group/teacher">
                                                                    <span className="truncate flex-1">{teacher.firstName} {teacher.lastName}</span>
                                                                    <span className="text-gray-400 truncate flex-1 mx-2">{teacher.email}</span>
                                                                    <button
                                                                        onClick={() => removeTeacherFromClass(cls.id, teacher.id)}
                                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover/teacher:opacity-100"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-center text-gray-400 italic">Aucun enseignant assigné.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'identity' ? (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                                    <Building className="w-5 h-5 mr-2 text-orange-600" />
                                    Fiche Identité Établissement
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'établissement</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolName || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolName: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse complète</label>
                                        <textarea
                                            rows={2}
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolAddress || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolAddress: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolPhone || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolPhone: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div className="hidden md:block"></div>
                                    <div className="md:col-span-2 border-t pt-4">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chef d'Établissement</span>
                                        {!canEditIdentity && <p className="text-xs text-red-500 mt-1 flex items-center"><Lock className="w-3 h-3 mr-1" /> Modification réservée au Chef d'Établissement ou Délégué.</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom & Prénom</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            placeholder="Ex: M. le Proviseur"
                                            value={useSchoolStore.getState().schoolHeadName || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolHeadName: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Validation)</label>
                                        <input
                                            type="email"
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolHeadEmail || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolHeadEmail: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                                    <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                                    Types de Convention Autorisés
                                </h4>
                                <p className="text-sm text-gray-500 mb-6">
                                    Sélectionnez les modèles de convention que les élèves de votre établissement peuvent choisir.
                                    Si un type est décoché, il ne sera plus proposé dans l'assistant de création.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { id: 'PFMP_STANDARD', label: 'PFMP Lycée Professionnel (Standard)' },
                                        { id: 'STAGE_2NDE', label: 'Stage de Seconde' },
                                        { id: 'ERASMUS_MOBILITY', label: 'Mobilité Erasmus+' },
                                        { id: 'BTS_INTERNSHIP', label: 'Convention de stage BTS' }
                                    ].map((type) => {
                                        const isAllowed = useSchoolStore.getState().allowedConventionTypes?.includes(type.id);
                                        const isDev = type.id === 'STAGE_2NDE' || type.id === 'ERASMUS_MOBILITY' || type.id === 'BTS_INTERNSHIP';

                                        return (
                                            <div
                                                key={type.id}
                                                className={`flex items-center p-4 border rounded-lg transition-colors ${isDev ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={type.id}
                                                    checked={isAllowed && !isDev} // Force unchecked if dev, or just respect store but disable? User said "proposer les choix en gris". Usually implies disabled. I'll respect store state but disable interaction. Actually, if it's in dev, it shouldn't be selectable. I'll disable input.
                                                    disabled={isDev}
                                                    onChange={(e) => useSchoolStore.getState().toggleConventionType(type.id, e.target.checked)}
                                                    className={`w-5 h-5 rounded focus:ring-blue-500 border-gray-300 ${isDev ? 'text-gray-400 cursor-not-allowed bg-gray-200' : 'text-blue-600'
                                                        }`}
                                                />
                                                <label
                                                    htmlFor={type.id}
                                                    className={`ml-3 block text-sm font-medium w-full ${isDev ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900 cursor-pointer'
                                                        }`}
                                                >
                                                    {type.label}
                                                    {isDev && <span className="ml-2 text-xs font-normal italic text-gray-400">(En cours de développement)</span>}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
