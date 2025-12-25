export interface Question {
    id: number;
    q: string;
    a: string;
    options: string[];
    exp: string;
}

export interface Task {
    title: string;
    questions: Question[];
}

export interface Tasks {
    [key: string]: Task;
}
