import unittest
import numpy as np
from generalized import disagreements,highlight_ids,local_select,observations,proposals,preserve_views,select,validate_selection


def line(s,x,y,w=300,h=20):return dict(text=s,confidence=.95,box=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]])

class GeneralizedTests(unittest.TestCase):
    def test_boundary_content_survives_and_badge_does_not_merge(self):
        ls=observations([line('A newly announced discovery changes this entire scientific field',0,0),line('Brief badge',0,27,60,9)])
        bs=proposals(ls)
        self.assertTrue(bs[0]['candidate']);self.assertEqual(bs[0]['line_ids'],['L0001']);self.assertEqual(len(ls),2)
    def test_same_column_feed_requires_target(self):
        ls=observations([line('A newly announced discovery changes this entire scientific field',0,10),line('Another independent story reports falling house prices today',0,120)])
        out=local_select(np.zeros((300,400,3),np.uint8),ls,proposals(ls))
        self.assertEqual(out['status'],'needs_target');self.assertEqual(len(out['candidates']),2)
    def test_relative_scale_translation_invariance(self):
        raw=[line('A long headline begins on this line',10,30),line('and continues onto the second line',10,53)]
        moved=[dict(l,box=[[x*2+900,y*2+500] for x,y in l['box']]) for l in raw]
        self.assertEqual([b['line_ids'] for b in proposals(observations(raw))],[b['line_ids'] for b in proposals(observations(moved))])
    def test_intent_selects_one_of_peer_items(self):
        ls=observations([line('Router failure caused a nationwide aviation shutdown yesterday',0,10),line('New scientific discovery changes our view of Mars',0,100)])
        out=local_select(np.zeros((300,400,3),np.uint8),ls,proposals(ls),'check router aviation shutdown')
        self.assertEqual(out['status'],'selected');self.assertEqual(out['selected_line_ids'],['L0001'])
    def test_invalid_ids_and_duplicate_rejected(self):
        ls=observations([line('A factual statement',10,10)])
        for ids in [['imagined'],['L0001','L0001']]:
            with self.assertRaises(ValueError):validate_selection(dict(status='selected',selected_line_ids=ids),ls)
    def test_model_generated_transcript_ignored(self):
        ls=observations([line('Observed 15 people did not vote',10,10)])
        out=validate_selection(dict(status='selected',selected_line_ids=['L0001'],text='50 people voted'),ls)
        self.assertEqual(out['text'],'Observed 15 people did not vote')
    def test_truncated_reading_is_never_accepted(self):
        ls=observations([line('The official report says Dea... View more',0,0)])
        out=validate_selection(dict(status='selected',selected_line_ids=['L0001']),ls)
        self.assertEqual(out['status'],'incomplete');self.assertEqual(out['fact_check_text'],'')
    def test_context_does_not_enter_claim(self):
        ls=observations([line('Reporter A',0,0),line('Observed number is 15',0,50)])
        out=validate_selection(dict(status='selected',selected_line_ids=['L0002'],context_line_ids=['L0001']),ls)
        self.assertEqual(out['text'],'Observed number is 15');self.assertEqual(out['context_text'],'Reporter A')
    def test_bad_provider_forces_abstention(self):
        class Bad:
            def select(self,*args):raise ValueError('Private provider message')
        out=select(np.zeros((200,500,3),np.uint8),[line('A long factual statement with enough words to qualify',0,0)],selector=Bad())
        self.assertEqual(out['selection']['status'],'needs_target');self.assertEqual(out['provider_error'],'ValueError');self.assertEqual(out['selection']['fact_check_text'],'')
    def test_reread_critical_disagreement_retained(self):
        out=disagreements('Alice said 15 people did not vote','Alice said 50 people did vote')
        self.assertFalse(out['agrees']);self.assertTrue(any(c['critical'] for c in out['changes']))
    def test_crop_missing_line_recovery_preserves_source(self):
        raw=[line('Original number 15',10,10)]
        crop=[line('Alternative number 50',10,10),line('New recovered paragraph',10,80)]
        ls,alternates=preserve_views(raw,crop)
        self.assertEqual([x['text'] for x in ls],['Original number 15','New recovered paragraph'])
        self.assertEqual(ls[1]['view_id'],'screen');self.assertEqual(alternates[0]['alternative_of'],['L0001'])
    def test_complete_views_reach_provider_without_replacing_source(self):
        class Provider:
            def select(self,im,lines,blocks,intent):
                self.lines=lines
                return validate_selection(dict(status='selected',selected_line_ids=['S0001']),lines)
        provider=Provider()
        out=select(np.zeros((200,500,3),np.uint8),[line('Observed number 15',10,10)],selector=provider,supplemental_lines=[line('Alternative number 50',10,10)],include_alternates=True)
        self.assertEqual([l['id'] for l in provider.lines],['L0001','S0001'])
        self.assertEqual([l['text'] for l in out['observations']],['Observed number 15','Alternative number 50'])
        self.assertEqual(out['selection']['text'],'Alternative number 50')
    def test_provider_order_cannot_reverse_headline(self):
        ls=observations([line('Headline begins',0,0),line('and continues',0,24)])
        out=validate_selection(dict(status='selected',selected_line_ids=['L0002','L0001']),ls)
        self.assertEqual(out['text'],'Headline begins\nand continues')
    def test_tilted_axis_bounds_do_not_split_paragraph(self):
        raw=[dict(text='Headline starts in this first visible line',confidence=.9,box=[[0,0],[400,17],[399,57],[0,40]]),dict(text='and continues on the second visible line',confidence=.9,box=[[0,42],[300,60],[299,98],[0,80]])]
        self.assertEqual(len(proposals(observations(raw))),1)
    def test_uniform_saturated_page_is_not_highlight(self):
        im=np.zeros((150,500,3),np.uint8);im[:]=[120,50,20]
        ls=observations([line('A navigation region with many separate words',10,20),line('A nearby navigation region with more words',10,44)])
        out=local_select(im,ls,proposals(ls))
        self.assertNotEqual(out['status'],'selected')
    def test_ordinary_read_more_phrase_is_complete(self):
        ls=observations([line('Children who read more score higher on tests',0,0)])
        out=validate_selection(dict(status='selected',selected_line_ids=['L0001']),ls)
        self.assertEqual(out['status'],'selected')
    def test_author_title_badge_link_have_separate_proposals(self):
        raw=[line('author_name',10,0,80,18),line('A router failure caused a nationwide aviation shutdown',10,20,400,18),line('Source',10,39,60,18),line('Small badge',10,65,70,15),line('https://example.org/story',10,85,300,15)]
        bs=proposals(observations(raw));target=next(b for b in bs if 'router' in b['text'])
        self.assertNotIn('author_name',target['text']);self.assertNotIn('badge',target['text']);self.assertNotIn('https',target['text']);self.assertIn('Source',target['text'])
    def test_highlight_hue_is_not_fixed(self):
        for color in [(0,220,220),(220,0,220),(0,180,0)]:
            im=np.full((120,500,3),255,np.uint8)
            im[30:50,50:350]=color;im[54:74,50:350]=color
            ls=observations([line('One selected paragraph line has these words',50,30,300,19),line('Another selected paragraph line ends here',50,54,300,19)])
            self.assertEqual(highlight_ids(im,ls),['L0001','L0002'])
    def test_colored_card_margin_is_not_highlight(self):
        im=np.full((150,500,3),255,np.uint8);im[5:120,20:420]=[20,30,220]
        ls=observations([line('One large colored story card starts here',70,30,280,20),line('Another wrapped line of the same card',70,55,280,20)])
        self.assertEqual(highlight_ids(im,ls),[])
    def test_bounded_reread(self):
        ls=observations([line('Observed text',0,0)])
        for region in [[0,0,1,1],[.2,.4,.1,.5],[0,0,float('nan'),.2]]:
            with self.assertRaises(ValueError):validate_selection(dict(status='selected',selected_line_ids=['L0001'],reread_region=region),ls)

if __name__=='__main__':unittest.main()
