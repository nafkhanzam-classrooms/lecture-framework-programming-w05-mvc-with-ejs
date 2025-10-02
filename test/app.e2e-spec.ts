import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { join } from 'path';
import * as express from 'express';
import expressLayouts from 'express-ejs-layouts';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Posts App (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    prisma = app.get<PrismaService>(PrismaService);

    // Configure view engine like in main.ts
    app.use(express.urlencoded({ extended: true }));
    app.use(expressLayouts);
    app.useStaticAssets(join(__dirname, '..', 'public'));
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.setViewEngine('ejs');
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    // Clean up database before each test
    await prisma.post.deleteMany();
  });

  afterAll(async () => {
    await prisma.post.deleteMany();
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(302); // Redirect to /posts
  });

  describe('Posts with Replies Display', () => {
    it('should display replies below their parent posts in index view', async () => {
      // Create a parent post
      const parentPost = await prisma.post.create({
        data: {
          posterName: 'John Doe',
          content: 'This is the main post',
        },
      });

      // Create replies to the parent post
      await prisma.post.create({
        data: {
          posterName: 'Jane Smith',
          content: 'This is a reply to the main post',
          replyToId: parentPost.id,
        },
      });

      await prisma.post.create({
        data: {
          posterName: 'Bob Wilson',
          content: 'This is another reply',
          replyToId: parentPost.id,
        },
      });

      // Get the posts index page
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const html = response.text;

      // Check that the parent post is displayed
      expect(html).toContain('John Doe');
      expect(html).toContain('This is the main post');

      // Check that replies are displayed below the parent post
      expect(html).toContain('Replies (2)');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('This is a reply to the main post');
      expect(html).toContain('Bob Wilson');
      expect(html).toContain('This is another reply');

      // Check that replies are visually nested (indented with border)
      expect(html).toContain('border-left: 3px solid #e9ecef');
      expect(html).toContain('padding-left: 15px');
    });

    it('should not display reply posts as separate top-level posts in index view', async () => {
      // Create a parent post
      const parentPost = await prisma.post.create({
        data: {
          posterName: 'John Doe',
          content: 'This is the main post',
        },
      });

      // Create a reply
      await prisma.post.create({
        data: {
          posterName: 'Jane Smith',
          content: 'This is a reply',
          replyToId: parentPost.id,
        },
      });

      // Get the posts index page
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const html = response.text;

      // Count occurrences of the reply content - it should only appear once (nested under parent)
      const replyMatches = (html.match(/This is a reply/g) || []).length;
      expect(replyMatches).toBe(1);

      // The reply should not appear as a separate post with its own "Replying to:" section
      expect(html).not.toContain('Replying to: <strong>John Doe</strong>');
    });

    it('should display replies with proper styling in show view', async () => {
      // Create a parent post
      const parentPost = await prisma.post.create({
        data: {
          posterName: 'John Doe',
          content: 'This is the main post',
        },
      });

      // Create a reply
      const reply = await prisma.post.create({
        data: {
          posterName: 'Jane Smith',
          content: 'This is a reply to the main post',
          replyToId: parentPost.id,
        },
      });

      // Get the post show page
      const response = await request(app.getHttpServer())
        .get(`/posts/${parentPost.id}`)
        .expect(200);

      const html = response.text;

      // Check that the reply is properly styled
      expect(html).toContain('border-left: 4px solid #28a745');
      expect(html).toContain('background-color: #f8f9fa');
      expect(html).toContain('color: #28a745'); // Reply author name color
      expect(html).toContain('Jane Smith');
      expect(html).toContain('This is a reply to the main post');

      // Check that reply has proper action buttons
      expect(html).toContain(`href="/posts/${reply.id}"`); // View button
      expect(html).toContain(`href="/posts/${reply.id}/reply"`); // Reply button
    });

    it('should handle posts with no replies correctly', async () => {
      // Create a post with no replies
      await prisma.post.create({
        data: {
          posterName: 'John Doe',
          content: 'This post has no replies',
        },
      });

      // Get the posts index page
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const html = response.text;

      // Check that the post is displayed
      expect(html).toContain('John Doe');
      expect(html).toContain('This post has no replies');

      // Check that no replies section is shown
      expect(html).not.toContain('Replies (');
    });

    it('should handle nested replies correctly', async () => {
      // Create a parent post
      const parentPost = await prisma.post.create({
        data: {
          posterName: 'John Doe',
          content: 'This is the main post',
        },
      });

      // Create a first-level reply
      const firstReply = await prisma.post.create({
        data: {
          posterName: 'Jane Smith',
          content: 'This is a first-level reply',
          replyToId: parentPost.id,
        },
      });

      // Create a second-level reply (reply to the reply)
      await prisma.post.create({
        data: {
          posterName: 'Bob Wilson',
          content: 'This is a reply to the reply',
          replyToId: firstReply.id,
        },
      });

      // Get the post show page for the first reply
      const response = await request(app.getHttpServer())
        .get(`/posts/${firstReply.id}`)
        .expect(200);

      const html = response.text;

      // Check that the nested reply is displayed in the replies section
      expect(html).toContain('Replies (1)');
      expect(html).toContain('Bob Wilson');
      expect(html).toContain('This is a reply to the reply');
    });

    it('should maintain proper post ordering with replies', async () => {
      // Create multiple posts with replies in a specific order
      const firstPost = await prisma.post.create({
        data: {
          posterName: 'First Author',
          content: 'First post',
        },
      });

      await prisma.post.create({
        data: {
          posterName: 'Second Author',
          content: 'Second post',
        },
      });

      // Add replies to the first post
      await prisma.post.create({
        data: {
          posterName: 'Replier',
          content: 'Reply to first post',
          replyToId: firstPost.id,
        },
      });

      // Get the posts index page
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const html = response.text;

      // Second post should appear before first post (due to desc ordering by createdAt)
      const secondPostIndex = html.indexOf('Second post');
      const firstPostIndex = html.indexOf('First post');

      expect(secondPostIndex).toBeLessThan(firstPostIndex);
      expect(secondPostIndex).toBeGreaterThan(-1);
      expect(firstPostIndex).toBeGreaterThan(-1);

      // Reply should appear under the first post
      const replyIndex = html.indexOf('Reply to first post');
      expect(replyIndex).toBeGreaterThan(firstPostIndex);
    });
  });
});
