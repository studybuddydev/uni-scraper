type DataExam = {
    id: string;
    universityId: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    goals?: string;
    requirements?: string;

    chapters?: {
        id: number;
        parentId: number | null;
        name: string;
        description: string;
    }[];
    urls?: {
        name: string;
        url: string;
    }[];
    teachers?: {
        name: string;
        email?: string;
    }[];

    cfu?: string;
    examMode?: string;
    hours?: string;
    semester?: string;
    year?: string;
    teachingYear?: string;
    deparment?: string;
    books?: string[];
    language?: string;
    note?: string
    color?: string;
    icon?: string;
}





// summary 
interface Exam {
    title: string;
    id: string;
    href: string;
    cfu: string;
    hours: string;
    semester: string;
    annoDiOfferta: string;
    year: number;
}


interface Course {
    name: string;
    id: string;
    uni: string;
    exams: Exam[];
    type: string;
}

interface DataCourse {
    id: string;
    universityId: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    goals?: string;
    requirements?: string;

    exams?: {
        examId: string;
        year?: string;
        semester?: string;
    }[];
    urls?: {
        name: string;
        url: string;
    }[];

    type?: string;
    language?: string;
    accessMode?: string;
    deparment?: string;
    note?: string;
}

interface SummaryCourse {
    name: string;
    code: string;
    type:string;
}

interface DataUniversities {
    id: string;
    name: string;
    lastUpdated: Date;
    deleted: Date | null;

    description?: string;
    urls?: {
        name: string;
        url: string;
    }[];
    courseIds?: string[];
    note?: string;
}


