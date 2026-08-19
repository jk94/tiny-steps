import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ChildValidationExceptionFilter } from './child-validation.exception-filter';

function mockHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ChildValidationExceptionFilter', () => {
  const filter = new ChildValidationExceptionFilter();

  it("reshapes the global ValidationPipe's default 400 body into a VALIDATION_ERROR with per-field messages", () => {
    const { host, response } = mockHost();
    const exception = new BadRequestException([
      'name should not be empty',
      'birthDate must not be in the future',
    ]);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: {
        name: ['name should not be empty'],
        birthDate: ['birthDate must not be in the future'],
      },
    });
  });

  it('buckets a message matching no known field under _other', () => {
    const { host, response } = mockHost();
    const exception = new BadRequestException(['property extra should not exist']);

    filter.catch(exception, host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { _other: ['property extra should not exist'] },
      }),
    );
  });

  it('passes a body that already carries a code through unchanged (photo validators, already reshaped)', () => {
    const { host, response } = mockHost();
    const exception = new BadRequestException({
      statusCode: 400,
      code: 'PHOTO_TOO_LARGE',
      message: 'The photo must be at most 2 MB.',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'PHOTO_TOO_LARGE',
      message: 'The photo must be at most 2 MB.',
    });
  });
});
