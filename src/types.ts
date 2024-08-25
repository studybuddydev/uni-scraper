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

type DataCourse = {
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

type DataUniversities = {
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


type Exam = {
    id: string;
    name: string;
    lastUpdated: Date;
    dataExamId: string;
    userId: string;

    chapters?: {
        id: number;
        parentId: number | null;
        name: string;
        description: string;

        urls?: {
            name: string;
            url: string;
        }[];
        tasks?: {
            name: string;
            description?: string;
            deadline?: Date;
            done?: boolean;
        }[];
        notes?: {
            name: string;
            description?: string;
            color?: string;
        }[];

    }[];

    color?: string;
    icon?: string;
}