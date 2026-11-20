import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_BASE_URL } from './config';
import { apiErrorKey } from './i18n/errors';
import { I18n } from './i18n/i18n.service';
import { translate } from './i18n/translate';
import {
  ApiError,
  ApiStatus,
  Catalog,
  Field,
  Question,
  QuestionType,
  Test,
  TestRequest,
} from './models';

// DTOs are the wire format of the API (spec, section 5). They stay private to this file,
// so components only ever see the models from models.ts.

/** `GET /api/health` (spec 5.3). */
interface HealthDto {
  status: string;
}

/** `GET /api/catalog` (spec 5.1). */
interface CatalogDto {
  fields: FieldDto[];
}

interface FieldDto {
  id: string;
  title: string;
  levels: { id: string; title: string; rank: number }[];
  directions: {
    id: string;
    title: string;
    stacks: { id: string; title: string; topicIds: string[] }[];
  }[];
  topics: {
    id: string;
    title: string;
    description: string | null;
    questionCounts: Record<string, number> | null;
  }[];
}

/** Body of `POST /api/tests` (spec 5.2). */
interface CreateTestDto {
  fieldId: string;
  levelIds: string[];
  topics: { topicId: string; count: number }[];
  excludeQuestionIds: string[];
}

/** Answer of `POST /api/tests` (spec 5.2). */
interface TestDto {
  questions: QuestionDto[];
}

interface QuestionDto {
  id: string;
  topicId: string;
  levelId: string;
  type: string;
  text: string;
  code: { lang: string; source: string } | null;
  options: { key: number; text: string; isCorrect: boolean }[];
  explanation: string;
}

/** The only place that talks to the API over HTTP. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  // Error texts and content come in the language on screen: injecting it here resolves the language
  // even before any page has rendered.
  private readonly i18n = inject(I18n);

  /** Never errors: an API that cannot be reached is reported as `unavailable`. */
  health(): Observable<ApiStatus> {
    return this.http.get<HealthDto>(`${this.baseUrl}/health`).pipe(
      map((dto): ApiStatus => (dto?.status === 'ok' ? 'available' : 'unavailable')),
      catchError(() => of<ApiStatus>('unavailable')),
    );
  }

  /** Errors only with {@link ApiError}. Titles and question counts are in the language on screen (spec 5.1). */
  getCatalog(): Observable<Catalog> {
    return this.http
      .get<CatalogDto>(`${this.baseUrl}/catalog`, { params: this.contentParams() })
      .pipe(
        map((dto): Catalog => ({ fields: dto.fields.map(toField) })),
        catchError((error: unknown) => throwError(() => toApiError(error))),
      );
  }

  /**
   * Errors only with {@link ApiError}; a rejected setup is worded by its `code`, never by the server's message.
   * Questions are in the language on screen, and only translated ones are picked (spec 5.2).
   */
  createTest(request: TestRequest): Observable<Test> {
    const body: CreateTestDto = {
      fieldId: request.fieldId,
      levelIds: [...request.levelIds],
      topics: request.topics.map((topic) => ({ topicId: topic.topicId, count: topic.count })),
      excludeQuestionIds: [...request.excludeQuestionIds],
    };
    return this.http
      .post<TestDto>(`${this.baseUrl}/tests`, body, { params: this.contentParams() })
      .pipe(
        map((dto): Test => ({ questions: dto.questions.map(toQuestion) })),
        catchError((error: unknown) => throwError(() => toApiError(error))),
      );
  }

  /**
   * `lang` of a content request (spec 5): the language on screen when the request is made. Added here,
   * so no caller can forget it; the body never carries it.
   */
  private contentParams(): HttpParams {
    return new HttpParams().set('lang', this.i18n.language());
  }
}

/** Text for the user from any error, so a page never shows an empty or `undefined` message. */
export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : translate('errors.server');
}

/** Worded in the language on screen at the moment of the error. */
function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    return new ApiError(translate(apiErrorKey(error.status, codeOf(error.error))));
  }
  // A body that does not match the contract.
  return new ApiError(translate('errors.server'));
}

/** `code` of the API's own `{ code, message }`; a 400 ProblemDetails from model binding has none. */
function codeOf(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const code = body.code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function toField(dto: FieldDto): Field {
  return {
    id: dto.id,
    title: dto.title,
    levels: dto.levels.map((level) => ({ id: level.id, title: level.title, rank: level.rank })),
    directions: dto.directions.map((direction) => ({
      id: direction.id,
      title: direction.title,
      stacks: direction.stacks.map((stack) => ({
        id: stack.id,
        title: stack.title,
        topicIds: [...stack.topicIds],
      })),
    })),
    topics: dto.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description ?? '',
      questionCounts: { ...topic.questionCounts },
    })),
  };
}

function toQuestion(dto: QuestionDto): Question {
  return {
    id: dto.id,
    topicId: dto.topicId,
    levelId: dto.levelId,
    type: dto.type as QuestionType,
    text: dto.text,
    code: dto.code ? { lang: dto.code.lang, source: dto.code.source } : null,
    options: dto.options.map((option) => ({
      key: option.key,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
    explanation: dto.explanation,
  };
}
