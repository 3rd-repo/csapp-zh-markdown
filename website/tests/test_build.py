import importlib.util
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image

SPEC = importlib.util.spec_from_file_location('site_build', Path(__file__).resolve().parents[1] / 'scripts/build.py')
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


class Elements(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.elements = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class ImageTests(unittest.TestCase):
    def test_image_keeps_path_alt_and_intrinsic_size(self):
        render = getattr(build, 'image_html', None)
        self.assertTrue(callable(render), 'Image generation needs intrinsic size and escaped attributes')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'figure.png'
            Image.new('RGB', (200, 80)).save(path)
            markup = render(path, '../../assets/a&b.png', 'A "quoted" <figure>', eager=True)
        img = dict(Elements(markup).elements)['img']
        self.assertEqual(img['src'], '../../assets/a&b.png')
        self.assertEqual(img['alt'], 'A "quoted" <figure>')
        self.assertEqual((img['width'], img['height']), ('200', '80'))
        self.assertEqual(img['loading'], 'eager')

    def test_later_images_are_deferred(self):
        render = getattr(build, 'image_html', None)
        self.assertTrue(callable(render), 'Later figures should load lazily')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'figure.jpg'
            Image.new('RGB', (300, 100)).save(path)
            img = dict(Elements(render(path, 'figure.jpg', '')).elements)['img']
        self.assertEqual(img['loading'], 'lazy')
        self.assertEqual(img['decoding'], 'async')


class NavigationTests(unittest.TestCase):
    def test_lab_navigation_follows_the_published_learning_order(self):
        ordered = getattr(build, 'lab_sections', None)
        self.assertTrue(callable(ordered), 'Lab navigation must follow its README, not alphabetic paths')
        paths = ordered(build.ROOT / '实验')
        self.assertEqual([p.stem for p in paths[:8]], [
            'datalab-zh', 'bomblab-zh', 'attacklab-zh', 'archlab-zh',
            'cachelab-zh', 'shlab-zh', 'malloclab-zh', 'proxylab-zh'
        ])
        self.assertEqual(len(paths), len(set(paths)))
        self.assertIn('simguide-zh', [p.stem for p in paths[8:]])


if __name__ == '__main__':
    unittest.main()
