import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: any, operation: string): never {
  if (error instanceof HttpException) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new HttpException(
          'A record with this data already exists',
          HttpStatus.CONFLICT,
        );
      case 'P2025':
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
      case 'P2003':
        throw new HttpException(
          'Foreign key constraint failed',
          HttpStatus.BAD_REQUEST,
        );
      case 'P2004':
        throw new HttpException(
          'Constraint failed on the database',
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  throw new HttpException(
    `Failed to ${operation}`,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
