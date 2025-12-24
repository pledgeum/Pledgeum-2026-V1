'use client';

import { useState, useRef } from 'react';
import { X, UserPlus, Trash2, Users, Briefcase, GraduationCap, Upload, FileUp, Sparkles } from 'lucide-react';
import { useSchoolStore, COLLABORATOR_LABELS, CollaboratorRole, Teacher } from '@/store/school';
import { useUserStore } from '@/store/user';
import Papa from 'papaparse';

interface SchoolAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SchoolAdminModal({ isOpen, onClose }: SchoolAdminModalProps) {
    const [activeTab, setActiveTab] = useState<'collaborators' | 'classes'>('collaborators');
    const { collaborators, classes, addCollaborator, removeCollaborator, addClass, removeClass, updateClass, importTeachers, addTeacherToClass, removeTeacherFromClass } = useSchoolStore();
    const { email } = useUserStore();

    // Form States
    const [newCollab, setNewCollab] = useState({ name: '', email: '', role: 'DDFPT' as CollaboratorRole });
    const [newClass, setNewClass] = useState({ name: '', mainTeachers: '', cpes: '' });

    // Teacher Management State
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
    const [newTeacher, setNewTeacher] = useState({ firstName: '', lastName: '', email: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const teachers: Omit<Teacher, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    // Adapt to 'Nom', 'Prénom', 'Email'/'Courriel'
                    const lastName = row['Nom'] || row['nom'];
                    const firstName = row['Prénom'] || row['prenom'] || row['Prenom'];
                    const email = row['Email'] || row['email'] || row['Courriel'] || row['courriel'];

                    if (lastName && firstName && email) {
                        teachers.push({ firstName, lastName, email });
                    }
                });

                if (teachers.length > 0) {
                    importTeachers(classId, teachers);
                    alert(`${teachers.length} enseignants importés avec succès.`);
                } else {
                    alert("Aucun enseignant valide trouvé dans le CSV. Vérifiez les colonnes (Nom, Prénom, Email).");
                }

                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => {
                console.error("CSV Import Error:", error);
                alert("Erreur lors de l'import CSV.");
            }
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
        // Add self as well for testing "Moi-même" logic if needed, but the dropdown handles "Moi-même" separately.
        // Let's add pledgeum as a teacher too just in case they want to select "from list" vs "Moi-même option"
        // importTeachers(classId, [{ firstName: 'Admin', lastName: 'Test', email: 'pledgeum@gmail.com' }]); 
    };

    const handleAddTeacher = (e: React.FormEvent, classId: string) => {
        e.preventDefault();
        if (newTeacher.firstName && newTeacher.lastName && newTeacher.email) {
            addTeacherToClass(classId, newTeacher);
            setNewTeacher({ firstName: '', lastName: '', email: '' });
        }
    };

    if (!isOpen) return null;

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
            addClass({ ...newClass, teachersList: [] });
            setNewClass({ name: '', mainTeachers: '', cpes: '' });
        }
    };

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
                        onClick={() => setActiveTab('collaborators')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'collaborators' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" />
                        <span>Collaborateurs</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'classes' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        <span>Classes & Professeurs</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    {activeTab === 'collaborators' ? (
                        <div className="space-y-8">
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
                    ) : (
                        <div className="space-y-8">
                            {/* Add Class Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
                    )}
                </div>
            </div>
        </div>
    );
}
