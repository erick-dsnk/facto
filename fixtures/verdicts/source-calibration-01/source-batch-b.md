# Very Deep Convolutional Networks for Large-Scale Image Recognition
URL: https://arxiv.org/abs/1409.1556
Published: 2014-09-04
Author: Karen Simonyan, Andrew Zisserman

# Very Deep Convolutional Networks for Large-Scale Image Recognition

arXiv:1409.1556. cs.CV. Submitted 2014-09-04. Latest version v6, 2015-04-10.

## Authors

Karen Simonyan, Andrew Zisserman

## Details

- License: http://arxiv.org/licenses/nonexclusive-distrib/1.0/

## Versions

- v1: 2014-09-04
- v2: 2014-09-15
- v3: 2014-11-18
- v4: 2014-12-19
- v5: 2014-12-23
- v6: 2015-04-10

---

Full text of v6.

## Abstract

In this work we investigate the effect of the convolutional network depth on its accuracy in the large-scale image recognition setting. Our main contribution is a thorough evaluation of networks of increasing depth using an architecture with very small ($3\times 3$) convolution filters, which shows that a significant improvement on the prior-art configurations can be achieved by pushing the depth to 16–19 weight layers. These findings were the basis of our ImageNet Challenge 2014 submission, where our team secured the first and the second places in the localisation and classification tracks respectively. We also show that our representations generalise well to other datasets, where they achieve state-of-the-art results. We have made our two best-performing ConvNet models publicly available to facilitate further research on the use of deep visual representations in computer vision.

## 1 Introduction

Convolutional networks (ConvNets) have recently enjoyed a great success in large-scale image and video recognition (Krizhevsky et al., 2012; Zeiler & Fergus, 2013; Sermanet et al., 2014; Simonyan & Zisserman, 2014) which has become possible due to the large public image repositories, such as ImageNet (Deng et al., 2009), and high-performance computing systems, such as GPUs or large-scale distributed clusters (Dean et al., 2012). In particular, an important role in the advance of deep visual recognition architectures has been played by the ImageNet Large-Scale Visual Recognition Challenge (ILSVRC) (Russakovsky et al., 2014), which has served as a testbed for a few generations of large-scale image classification systems, from high-dimensional shallow feature encodings (Perronnin et al., 2010) (the winner of ILSVRC-2011) to deep ConvNets (Krizhevsky et al., 2012) (the winner of ILSVRC-2012).

With ConvNets becoming more of a commodity in the computer vision field, a number of attempts have been made to improve the original architecture of Krizhevsky et al. (2012) in a bid to achieve better accuracy. For instance, the best-performing submissions to the ILSVRC-2013 (Zeiler & Fergus, 2013; Sermanet et al., 2014) utilised smaller receptive window size and smaller stride of the first convolutional layer. Another line of improvements dealt with training and testing the networks densely over the whole image and over multiple scales (Sermanet et al., 2014; Howard, 2014). In this paper, we address another important aspect of ConvNet architecture design – its depth. To this end, we fix other parameters of the architecture, and steadily increase the depth of the network by adding more convolutional layers, which is feasible due to the use of very small ($3\times 3$) convolution filters in all layers.

As a result, we come up with significantly more accurate ConvNet architectures, which not only achieve the state-of-the-art accuracy on ILSVRC classification and localisation tasks, but are also applicable to other image recognition datasets, where they achieve excellent performance even when used as a part of a relatively simple pipelines (e.g. deep features classified by a linear SVM without fine-tuning). We have released our two best-performing models[^1] to facilitate further research.

The rest of the paper is organised as follows. In Sect. 2, we describe our ConvNet configurations. The details of the image classification training and evaluation are then presented in Sect. 3, and the configurations are compared on the ILSVRC classification task in Sect. 4. Sect. 5 concludes the paper. For completeness, we also describe and assess our ILSVRC-2014 object localisation system in Appendix A, and discuss the generalisation of very deep features to other datasets in Appendix B. Finally, Appendix C contains the list of major paper revisions.

## 2 ConvNet Configurations

To measure the improvement brought by the increased ConvNet depth in a fair setting, all our ConvNet layer configurations are designed using the same principles, inspired by Ciresan et al. (2011); Krizhevsky et al. (2012). In this section, we first describe a generic layout of our ConvNet configurations (Sect. 2.1) and then detail the specific configurations used in the evaluation (Sect. 2.2). Our design choices are then discussed and compared to the prior art in Sect. 2.3.

### 2.1 Architecture

During training, the input to our ConvNets is a fixed-size $224\times 224$ RGB image. The only pre-processing we do is subtracting the mean RGB value, computed on the training set, from each pixel. The image is passed through a stack of convolutional (conv.) layers, where we use filters with a very small receptive field: $3\times 3$ (which is the smallest size to capture the notion of left/right, up/down, center). In one of the configurations we also utilise $1\times 1$ convolution filters, which can be seen as a linear transformation of the input channels (followed by non-linearity). The convolution stride is fixed to $1$ pixel; the spatial padding of conv. layer input is such that the spatial resolution is preserved after convolution, i.e. the padding is $1$ pixel for $3\times 3$ conv. layers. Spatial pooling is carried out by five max-pooling layers, which follow some of the conv. layers (not all the conv. layers are followed by max-pooling). Max-pooling is performed over a $2\times 2$ pixel window, with stride $2$.

A stack of convolutional layers (which has a different depth in different architectures) is followed by three Fully-Connected (FC) layers: the first two have 4096 channels each, the third performs 1000-way ILSVRC classification and thus contains 1000 channels (one for each class). The final layer is the soft-max layer. The configuration of the fully connected layers is the same in all networks.

All hidden layers are equipped with the rectification (ReLU (Krizhevsky et al., 2012)) non-linearity. We note that none of our networks (except for one) contain Local Response Normalisation (LRN) normalisation (Krizhevsky et al., 2012): as will be shown in Sect. 4, such normalisation does not improve the performance on the ILSVRC dataset, but leads to increased memory consumption and computation time. Where applicable, the parameters for the LRN layer are those of (Krizhevsky et al., 2012).

### 2.2 Configurations

The ConvNet configurations, evaluated in this paper, are outlined in Table 1, one per column. In the following we will refer to the nets by their names (A–E). All configurations follow the generic design presented in Sect. 2.1, and differ only in the depth: from 11 weight layers in the network A (8 conv. and 3 FC layers) to 19 weight layers in the network E (16 conv. and 3 FC layers). The width of conv. layers (the number of channels) is rather small, starting from $64$ in the first layer and then increasing by a factor of $2$ after each max-pooling layer, until it reaches $512$.

In Table 2 we report the number of parameters for each configuration. In spite of a large depth, the number of weights in our nets is not greater than the number of weights in a more shallow net with larger conv. layer widths and receptive fields (144M weights in (Sermanet et al., 2014)).

Table 1: ConvNet configurations (shown in columns). The depth of the configurations increases from the left (A) to the right (E), as more layers are added (the added layers are shown in bold). The convolutional layer parameters are denoted as “conv$\langle$receptive field size$\rangle$-$\langle$number of channels$\rangle$”. The ReLU activation function is not shown for brevity.

| ConvNet Configuration | | | | | |
| --- | --- | --- | --- | --- | --- |
| A | A-LRN | B | C | D | E |
| 11 weight | 11 weight | 13 weight | 16 weight | 16 weight | 19 weight |
| layers | layers | layers | layers | layers | layers |
| input ($224\times 224$ RGB image) | | | | | |
| conv3-64 | conv3-64 | conv3-64 | conv3-64 | conv3-64 | conv3-64 |
| | LRN | conv3-64 | conv3-64 | conv3-64 | conv3-64 |
| maxpool | | | | | |
| conv3-128 | conv3-128 | conv3-128 | conv3-128 | conv3-128 | conv3-128 |
| | | conv3-128 | conv3-128 | conv3-128 | conv3-128 |
| maxpool | | | | | |
| conv3-256 | conv3-256 | conv3-256 | conv3-256 | conv3-256 | conv3-256 |
| conv3-256 | conv3-256 | conv3-256 | conv3-256 | conv3-256 | conv3-256 |
| | | | conv1-256 | conv3-256 | conv3-256 |
| | | | | | conv3-256 |
| maxpool | | | | | |
| conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 |
| conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 |
| | | | conv1-512 | conv3-512 | conv3-512 |
| | | | | | conv3-512 |
| maxpool | | | | | |
| conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 |
| conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 | conv3-512 |
| | | | conv1-512 | conv3-512 | conv3-512 |
| | | | | | conv3-512 |
| maxpool | | | | | |
| FC-4096 | | | | | |
| FC-4096 | | | | | |
| FC-1000 | | | | | |
| soft-max | | | | | |

Table 2: Number of parameters (in millions).

| Network | A,A-LRN | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| Number of parameters | 133 | 133 | 134 | 138 | 144 |

### 2.3 Discussion

Our ConvNet configurations are quite different from the ones used in the top-performing entries of the ILSVRC-2012 (Krizhevsky et al., 2012) and ILSVRC-2013 competitions (Zeiler & Fergus, 2013; Sermanet et al., 2014). Rather than using relatively large receptive fields in the first conv. layers (e.g. $11\times 11$ with stride $4$ in (Krizhevsky et al., 2012), or $7\times 7$ with stride $2$ in (Zeiler & Fergus, 2013; Sermanet et al., 2014)), we use very small $3\times 3$ receptive fields throughout the whole net, which are convolved with the input at every pixel (with stride $1$). It is easy to see that a stack of two $3\times 3$ conv. layers (without spatial pooling in between) has an effective receptive field of $5\times 5$; three such layers have a $7\times 7$ effective receptive field. So what have we gained by using, for instance, a stack of three $3\times 3$ conv. layers instead of a single $7\times 7$ layer? First, we incorporate three non-linear rectification layers instead of a single one, which makes the decision function more discriminative. Second, we decrease the number of parameters: assuming that both the input and the output of a three-layer $3\times 3$ convolution stack has $C$ channels, the stack is parametrised by $3\left(3^{2}C^{2}\right)=27C^{2}$ weights; at the same time, a single $7\times 7$ conv. layer would require $7^{2}C^{2}=49C^{2}$ parameters, i.e. $81\%$ more. This can be seen as imposing a regularisation on the $7\times 7$ conv. filters, forcing them to have a decomposition through the $3\times 3$ filters (with non-linearity injected in between).

The incorporation of $1\times 1$ conv. layers (configuration C, Table 1) is a way to increase the non-linearity of the decision function without affecting the receptive fields of the conv. layers. Even though in our case the $1\times 1$ convolution is essentially a linear projection onto the space of the same dimensionality (the number of input and output channels is the same), an additional non-linearity is introduced by the rectification function. It should be noted that $1\times 1$ conv. layers have recently been utilised in the “Network in Network” architecture of Lin et al. (2014).

Small-size convolution filters have been previously used by Ciresan et al. (2011), but their nets are significantly less deep than ours, and they did not evaluate on the large-scale ILSVRC dataset. Goodfellow et al. (2014) applied deep ConvNets ($11$ weight layers) to the task of street number recognition, and showed that the increased depth led to better performance. GoogLeNet (Szegedy et al., 2014), a top-performing entry of the ILSVRC-2014 classification task, was developed independently of our work, but is similar in that it is based on very deep ConvNets (22 weight layers) and small convolution filters (apart from $3\times 3$, they also use $1\times 1$ and $5\times 5$ convolutions). Their network topology is, however, more complex than ours, and the spatial resolution of the feature maps is reduced more aggressively in the first layers to decrease the amount of computation. As will be shown in Sect. 4.5, our model is outperforming that of Szegedy et al. (2014) in terms of the single-network classification accuracy.

## 3 Classification Framework

In the previous section we presented the details of our network configurations. In this section, we describe the details of classification ConvNet training and evaluation.

### 3.1 Training

The ConvNet training procedure generally follows Krizhevsky et al. (2012) (except for sampling the input crops from multi-scale training images, as explained later). Namely, the training is carried out by optimising the multinomial logistic regression objective using mini-batch gradient descent (based on back-propagation (LeCun et al., 1989)) with momentum. The batch size was set to $256$, momentum to $0.9$. The training was regularised by weight decay (the $L_{2}$ penalty multiplier set to $5\cdot 10^{-4}$) and dropout regularisation for the first two fully-connected layers (dropout ratio set to $0.5$). The learning rate was initially set to $10^{-2}$, and then decreased by a factor of $10$ when the validation set accuracy stopped improving. In total, the learning rate was decreased 3 times, and the learning was stopped after $370$K iterations (74 epochs). We conjecture that in spite of the larger number of parameters and the greater depth of our nets compared to (Krizhevsky et al., 2012),

# United Nations Charter (full text) | United Nations
URL: https://www.un.org/en/about-us/un-charter/full-text

United Nations Charter (full text) | United Nations

# United Nations Charter (full text)

## Preamble

### WE THE PEOPLES OF THE UNITED NATIONS DETERMINED

to save succeeding generations from the scourge of war, which twice in our lifetime has brought untold sorrow to mankind, and

to reaffirm faith in fundamental human rights, in the dignity and worth of the human person, in the equal rights of men and women and of nations large and small, and

to establish conditions under which justice and respect for the obligations arising from treaties and other sources of international law can be maintained, and

to promote social progress and better standards of life in larger freedom,

### AND FOR THESE ENDS

to practice tolerance and live together in peace with one another as good neighbours, and

to unite our strength to maintain international peace and security, and

to ensure, by the acceptance of principles and the institution of methods, that armed force shall not be used, save in the common interest, and

to employ international machinery for the promotion of the economic and social advancement of all peoples,

### HAVE RESOLVED TO COMBINE OUR EFFORTS TO ACCOMPLISH THESE AIMS.

Accordingly, our respective Governments, through representatives assembled in the city of San Francisco, who have exhibited their full powers found to be in good and due form, have agreed to the present Charter of the United Nations and do hereby establish an international organization to be known as the United Nations.

## Chapter I: Purposes and Principles

### Article 1

The Purposes of the United Nations are:

1. To maintain international peace and security, and to that end: to take effective collective measures for the prevention and removal of threats to the peace, and for the suppression of acts of aggression or other breaches of the peace, and to bring about by peaceful means, and in conformity with the principles of justice and international law, adjustment or settlement of international disputes or situations which might lead to a breach of the peace;
2. To develop friendly relations among nations based on respect for the principle of equal rights and self-determination of peoples, and to take other appropriate measures to strengthen universal peace;
3. To achieve international co-operation in solving international problems of an economic, social, cultural, or humanitarian character, and in promoting and encouraging respect for human rights and for fundamental freedoms for all without distinction as to race, sex, language, or religion; and
4. To be a centre for harmonizing the actions of nations in the attainment of these common ends.

### Article 2

The Organization and its Members, in pursuit of the Purposes stated in Article 1, shall act in accordance with the following Principles.

1. The Organization is based on the principle of the sovereign equality of all its Members.
2. All Members, in order to ensure to all of them the rights and benefits resulting from membership, shall fulfill in good faith the obligations assumed by them in accordance with the present Charter.
3. All Members shall settle their international disputes by peaceful means in such a manner that international peace and security, and justice, are not endangered.
4. All Members shall refrain in their international relations from the threat or use of force against the territorial integrity or political independence of any state, or in any other manner inconsistent with the Purposes of the United Nations.
5. All Members shall give the United Nations every assistance in any action it takes in accordance with the present Charter, and shall refrain from giving assistance to any state against which the United Nations is taking preventive or enforcement action.
6. The Organization shall ensure that states which are not Members of the United Nations act in accordance with these Principles so far as may be necessary for the maintenance of international peace and security.
7. Nothing contained in the present Charter shall authorize the United Nations to intervene in matters which are essentially within the domestic jurisdiction of any state or shall require the Members to submit such matters to settlement under the present Charter; but this principle shall not prejudice the application of enforcement measures under Chapter Vll.

## Chapter II: Membership

### Article 3

The original Members of the United Nations shall be the states which, having participated in the United Nations Conference on International Organization at San Francisco, or having previously signed the Declaration by United Nations of 1 January 1942, sign the present Charter and ratify it in accordance with Article 110.

### Article 4

1. Membership in the United Nations is open to all other peace-loving states which accept the obligations contained in the present Charter and, in the judgment of the Organization, are able and willing to carry out these obligations.
2. The admission of any such state to membership in the United Nations will be effected by a decision of the General Assembly upon the recommendation of the Security Council.

### Article 5

A Member of the United Nations against which preventive or enforcement action has been taken by the Security Council may be suspended from the exercise of the rights and privileges of membership by the General Assembly upon the recommendation of the Security Council. The exercise of these rights and privileges may be restored by the Security Council.

### Article 6

A Member of the United Nations which has persistently violated the Principles contained in the present Charter may be expelled from the Organization by the General Assembly upon the recommendation of the Security Council.

## Chapter III: Organs

### Article 7

1. There are established as principal organs of the United Nations: a General Assembly, a Security Council, an Economic and Social Council, a Trusteeship Council, an International Court of Justice and a Secretariat.
2. Such subsidiary organs as may be found necessary may be established in accordance with the present Charter.

### Article 8

The United Nations shall place no restrictions on the eligibility of men and women to participate in any capacity and under conditions of equality in its principal and subsidiary organs.

## Chapter IV: The General Assembly

### Article 9

1. The General Assembly shall consist of all the Members of the United Nations.
2. Each Member shall have not more than five representatives in the General Assembly.

### Article 10

The General Assembly may discuss any questions or any matters within the scope of the present Charter or relating to the powers and functions of any organs provided for in the present Charter, and, except as provided in Article 12, may make recommendations to the Members of the United Nations or to the Security Council or to both on any such questions or matters.

### Article 11

1. The General Assembly may consider the general principles of co-operation in the maintenance of international peace and security, including the principles governing disarmament and the regulation of armaments, and may make recommendations with regard to such principles to the Members or to the Security Council or to both.
2. The General Assembly may discuss any questions relating to the maintenance of international peace and security brought before it by any Member of the United Nations, or by the Security Council, or by a state which is not a Member of the United Nations in accordance with Article 35, paragraph 2, and, except as provided in Article 12, may make recommendations with regard to any such questions to the state or states concerned or to the Security Council or to both. Any such question on which action is necessary shall be referred to the Security Council by the General Assembly either before or after discussion.
3. The General Assembly may call the attention of the Security Council to situations which are likely to endanger international peace and security.
4. The powers of the General Assembly set forth in this Article shall not limit the general scope of Article 10.

### Article 12

1. While the Security Council is exercising in respect of any dispute or situation the functions assigned to it in the present Charter, the General Assembly shall not make any recommendation with regard to that dispute or situation unless the Security Council so requests.
2. The Secretary-General, with the consent of the Security Council, shall notify the General Assembly at each session of any matters relative to the maintenance of international peace and security which are being dealt with by the Security Council and shall similarly notify the General Assembly, or the Members of the United Nations if the General Assembly is not in session, immediately the Security Council ceases to deal with such matters.

### Article 13

1. The General Assembly shall initiate studies and make recommendations for the purpose of: 

1. promoting international co-operation in the political field and encouraging the progressive development of international law and its codification;
2. promoting international co-operation in the economic, social, cultural, educational, and health fields, and assisting in the realization of human rights and fundamental freedoms for all without distinction as to race, sex, language, or religion.
2. The further responsibilities, functions and powers of the General Assembly with respect to matters mentioned in paragraph 1 (b) above are set forth in Chapters IX and X.

### Article 14

Subject to the provisions of Article 12, the General Assembly may recommend measures for the peaceful adjustment of any situation, regardless of origin, which it deems likely to impair the general welfare or friendly relations among nations, including situations resulting from a violation of the provisions of the present Charter setting forth the Purposes and Principles of the United Nations.

### Article 15

1. The General Assembly shall receive and consider annual and special reports from the Security Council; these reports shall include an account of the measures that the Security Council has decided upon or taken to maintain international peace and security.
2. The General Assembly shall receive and consider reports from the other organs of the United Nations.

### Article 16

The General Assembly shall perform such functions with respect to the international trusteeship system as are assigned to it under Chapters XII and XIII, including the approval of the trusteeship agreements for areas not designated as strategic.

### Article 17

1. The General Assembly shall consider and approve the budget of the Organization.
2. The expenses of the Organization shall be borne by the Members as apportioned by the General Assembly.
3. The General Assembly shall consider and approve any financial and budgetary arrangements with specialized agencies referred to in Article 57 and shall examine the administrative budgets of such specialized agencies with a view to making recommendations to the agencies concerned.

### Article 18

1. Each member of the General Assembly shall have one vote.
2. Decisions of the General Assembly on important questions shall be made by a two-thirds majority of the members present and voting. These questions shall include: recommendations with respect to the maintenance of international peace and security, the election of the non-permanent members of the Security Council, the election of the members of the Economic and Social Council, the election of members of the Trusteeship Council in accordance with paragraph 1 (c) of Article 86, the admission of new Members to the United Nations, the suspension of the rights and privileges of membership, the expulsion of Members, questions relating to the operation of the trusteeship system, and budgetary questions.
3. Decisions on other questions, including the determination of additional categories of questions to be decided by a two-thirds majority, shall be made by a majority of the members present and voting.

### Article 19

A Member of the United Nations which is in arrears in the payment of its financial contributions to the Organization shall have no vote in the General Assembly if the amount of its arrears equals or exceeds the amount of the contributions due from it for the preceding two full years. The General Assembly may, nevertheless, permit such a Member to vote if it is satisfied that the failure to pay is due to conditions beyond the control of the Member.

The General Assembly shall meet in regular annual sessions and in such special sessions as occasion may require. Special sessions shall be convoked by the Secretary-General at the request of the Security Council or of a majority of the Members of the United Nations.

### Article 21

The General Assembly shall adopt its own rules of procedure. It shall elect its President for each session.

### Article 22

The General Assembly may establish such subsidiary organs as it deems necessary for the performance of its functions.

## Chapter V: The Security Council

1. The Security Council shall consist of fifteen Members of the United Nations. The Republic of China, France, the Union of Soviet Socialist Republics, the United Kingdom of Great Britain and Northern Ireland, and the United States of America shall be permanent members of the Security Council. The General Assembly shall elect ten other Members of the United Nations to be non-permanent members of the Security Council, due regard being specially paid, in the first instance to the contribution of Members of the United Nations to the maintenance of international peace and security and to the other purposes of the Organization, and also to equitable geographical distribution.
2. The non-permanent members of the Security Council shall be elected for a term of two years. In the first election of the non-permanent members after the increase of the membership of the Secur

# Emancipation Proclamation (1863) | National Archives
URL: https://www.archives.gov/milestone-documents/emancipation-proclamation

Emancipation Proclamation (1863) | National Archives

# Emancipation Proclamation (1863)

View Transcript

President Abraham Lincoln issued the Emancipation Proclamation on January 1, 1863, announcing, "that all persons held as slaves" within the rebellious areas "are, and henceforward shall be free."

Initially, the Civil War between North and South was fought by the North to prevent the secession of the Southern states and preserve the Union. Even though sectional conflicts over slavery had been a major cause of the war, ending slavery was not a goal of the war.

That changed on September 22, 1862, when President Lincoln issued his Preliminary Emancipation Proclamation, which stated that enslaved people in those states or parts of states still in rebellion as of January 1, 1863, would be declared free. One hundred days later, with the rebellion unabated, President issued the Emancipation Proclamation declaring "that all persons held as slaves" within the rebellious areas "are, and henceforward shall be free."

Lincoln’s bold step to change the goals of the war was a military measure and came just a few days after the Union’s victory in the Battle of Antietam. With this Proclamation he hoped to inspire all Black people, and enslaved people in the Confederacy in particular, to support the Union cause and to keep England and France from giving political recognition and military aid to the Confederacy.

Because it was a military measure, however, the Emancipation Proclamation was limited in many ways. It applied only to states that had seceded from the Union, leaving slavery untouched in the loyal border states. It also expressly exempted parts of the Confederacy that had already come under Union control. Most important, the freedom it promised depended upon Union military victory.

Although the Emancipation Proclamation did not end slavery in the nation, it did fundamentally transform the character of the war. After January 1, 1863, every advance of federal troops expanded the domain of freedom. Moreover, the Proclamation announced the acceptance of Black men into the Union Army and Navy, enabling the liberated to become liberators. By the end of the war, almost 200,000 Black soldiers and sailors had fought for the Union and freedom.

From the first days of the Civil War, enslaved people had acted to secure their own liberty. The Emancipation Proclamation confirmed their insistence that the war for the Union must become a war for freedom. It added moral force to the Union cause and strengthened the Union both militarily and politically. As a milestone along the road to slavery's final destruction, the Emancipation Proclamation has assumed a place among the great documents of human freedom.

## Teach with this document.

## Transcript

By the President of the United States of America:

A Proclamation.

Whereas, on the twenty-second day of September, in the year of our Lord one thousand eight hundred and sixty-two, a proclamation was issued by the President of the United States, containing, among other things, the following, to wit:

"That on the first day of January, in the year of our Lord one thousand eight hundred and sixty-three, all persons held as slaves within any State or designated part of a State, the people whereof shall then be in rebellion against the United States, shall be then, thenceforward, and forever free; and the Executive Government of the United States, including the military and naval authority thereof, will recognize and maintain the freedom of such persons, and will do no act or acts to repress such persons, or any of them, in any efforts they may make for their actual freedom.

"That the Executive will, on the first day of January aforesaid, by proclamation, designate the States and parts of States, if any, in which the people thereof, respectively, shall then be in rebellion against the United States; and the fact that any State, or the people thereof, shall on that day be, in good faith, represented in the Congress of the United States by members chosen thereto at elections wherein a majority of the qualified voters of such State shall have participated, shall, in the absence of strong countervailing testimony, be deemed conclusive evidence that such State, and the people thereof, are not then in rebellion against the United States."

Now, therefore I, Abraham Lincoln, President of the United States, by virtue of the power in me vested as Commander-in-Chief, of the Army and Navy of the United States in time of actual armed rebellion against the authority and government of the United States, and as a fit and necessary war measure for suppressing said rebellion, do, on this first day of January, in the year of our Lord one thousand eight hundred and sixty-three, and in accordance with my purpose so to do publicly proclaimed for the full period of one hundred days, from the day first above mentioned, order and designate as the States and parts of States wherein the people thereof respectively, are this day in rebellion against the United States, the following, to wit:

Arkansas, Texas, Louisiana, (except the Parishes of St. Bernard, Plaquemines, Jefferson, St. John, St. Charles, St. James Ascension, Assumption, Terrebonne, Lafourche, St. Mary, St. Martin, and Orleans, including the City of New Orleans) Mississippi, Alabama, Florida, Georgia, South Carolina, North Carolina, and Virginia, (except the forty-eight counties designated as West Virginia, and also the counties of Berkley, Accomac, Northampton, Elizabeth City, York, Princess Ann, and Norfolk, including the cities of Norfolk and Portsmouth[)], and which excepted parts, are for the present, left precisely as if this proclamation were not issued.

And by virtue of the power, and for the purpose aforesaid, I do order and declare that all persons held as slaves within said designated States, and parts of States, are, and henceforward shall be free; and that the Executive government of the United States, including the military and naval authorities thereof, will recognize and maintain the freedom of said persons.

And I hereby enjoin upon the people so declared to be free to abstain from all violence, unless in necessary self-defence; and I recommend to them that, in all cases when allowed, they labor faithfully for reasonable wages.

And I further declare and make known, that such persons of suitable condition, will be received into the armed service of the United States to garrison forts, positions, stations, and other places, and to man vessels of all sorts in said service.

And upon this act, sincerely believed to be an act of justice, warranted by the Constitution, upon military necessity, I invoke the considerate judgment of mankind, and the gracious favor of Almighty God.

In witness whereof, I have hereunto set my hand and caused the seal of the United States to be affixed.

Done at the City of Washington, this first day of January, in the year of our Lord one thousand eight hundred and sixty three, and of the Independence of the United States of America the eighty-seventh.

By the President: ABRAHAM LINCOLN WILLIAM H. SEWARD, Secretary of State.

 This page was last reviewed on May 10, 2022. Contact us with questions or comments.

# 1903-The First Flight - Wright Brothers National Memorial (U.S. National Park Service)
URL: https://www.nps.gov/wrbr/learn/historyculture/thefirstflight.htm

1903-The First Flight - Wright Brothers National Memorial (U.S. National Park Service)

# 1903-The First Flight

Samuel Langley testing off a houseboat in 1893. USAF

Since 1899, Wilbur and Orville Wright had been scientifically experimenting with the concepts of flight. They labored in relative obscurity, while the experiments of Samuel Langley of the Smithsonian were followed in the press and underwritten by the War Department. Yet Langley, as others before him, had failed to achieve powered flight. They relied on brute power to keep their theoretically stable machines aloft, sending along a hapless passenger and hoping for the best. It was the Wrights' genius and vision to see that humans would have to fly their machines, that the problems of flight could not be solved from the ground. In Wilbur's words, "It is possible to fly without motors, but not without knowledge and skill." With over a thousand glides from atop Big Kill Devil Hill, the Wrights made themselves the first true pilots. These flying skills were a crucial component of their invention. Before they ever attempted powered flight, the Wright brothers were masters of the air.

A 1928 reproduction of the Wright brothers' engine for 1903 Flyer. Library of Congress; Prints and Photographs Division; LC-W86- 58

Their glider experiments on the Outer Banks of North Carolina, though frustrating at times, had led them down the path of discovery. Through those experiments, they had solved the problem of sustained lift and more importantly they could now control an aircraft while in flight. The brothers felt they were now ready to truly fly. But first, the Wrights had to power their aircraft. Gasoline engine technology had recently advanced to where its use in airplanes was feasible. Unable to find a suitable lightweight commercial engine, the brothers designed their own. It was cruder and less powerful than Samuel Langley's, but the Wrights understood that relatively little power was needed with efficient lifting surfaces and propellers. Such propellers were not available, however. Scant relevant data could be derived from marine propeller theory. Using their air tunnel data, they designed the first efficient airplane propeller, one of their most original and purely scientific achievements.

Returning to their camp at the Kill Devil Hills, they mounted the engine on the new 40-foot, 605-pound Flyer with double tails and elevators. The engine drove two pusher propellers with chains, one crossed to make the props rotate in opposite directions to counteract a twisting tendency in flight. A balky engine and broken propeller shaft slowed them, until they were finally ready on December 14th. In order to decide who would fly first, the brother tossed a coin. Wilbur won the coin toss, but lost his chance to be the first to fly when he oversteered with the elevator after leaving the launching rail. The flyer, climbed too steeply, stalled, and dove into the sand. The first flight would have to wait on repairs.

December 17, 1903 Three days later, they were ready for the second attempt. The 27-mph wind was harder than they would have liked, since their predicted cruising speed was only 30-35 mph. The headwind would slow their groundspeed to a crawl, but they proceeded anyway. With a sheet, they signaled the volunteers from the nearby lifesaving station that they were about to try again. Now it was Orville's turn.

Remembering Wilbur's experience, he positioned himself and tested the controls. The stick that moved the horizontal elevator controlled climb and descent. The cradle that he swung with his hips warped the wings and swung the vertical tails, which in combination turned the machine. A lever controlled the gas flow and airspeed recorder. The controls were simple and few, but Orville knew it would take all his finesse to handle the new and heavier aircraft.

Orville takes off with Wilbur running beside, December 17, 1903. NPS

At 10:35, he released the restraining wire. The flyer moved down the rail as Wilbur steadied the wings. Just as Orville left the ground, John Daniels from the lifesaving station snapped the shutter on a preset camera, capturing the historic image of the airborne aircraft with Wilbur running alongside. Again, the flyer was unruly, pitching up and down as Orville overcompensated with the controls. But he kept it aloft until it hit the sand about 120 feet from the rail. Into the 27-mph wind, the groundspeed had been 6.8 mph, for a total airspeed of 34 mph. The brothers took turns flying three more times that day, getting a feel for the controls and increasing their distance with each flight. Wilbur's second flight - the fourth and last of the day – was an impressive 852 feet in 59 seconds.

This was the real thing, transcending the powered hops and glides others had achieved. The Wright machine had flown. But it would not fly again; after the last flight it was caught by a gust of wind, rolled over, and damaged beyond easy repair. With their flying season over, the Wrights sent their father a matter-of-fact telegram reporting the modest numbers behind their epochal achievement.

Last updated: April 14, 2015

### Contact Info

#### Mailing Address:

 Wright Brothers National Memorial 1401 National Park Drive Manteo, NC 27954 

#### Phone:

 252 473-2111

# (no title)
URL: https://www.si.edu/spotlight/hope-diamond/history

Skip to main content Skip to main navigation

## Explore

## Explore

- The Hope Diamond
- History
- Suggested Reading

The history of the stone which was eventually named the Hope Diamond began when the French merchant traveler, Jean Baptiste Tavernier, purchased a 112 3/16-carat diamond. This diamond, which was most likely from the Kollur mine in Golconda, India, was somewhat triangular in shape and crudely cut. Its color was described by Tavernier as a "beautiful violet."

Tavernier sold the diamond to King Louis XIV of France in 1668 with 14 other large diamonds and several smaller ones. In 1673, the stone was recut by Sieur Pitau, the court jeweler, resulting in a 67 1/8-carat stone. In the royal inventories, its color was described as an intense steely-blue and the stone became known as the "Blue Diamond of the Crown," or the "French Blue." It was set in gold and suspended on a neck ribbon which the king wore on ceremonial occasions.

King Louis XV, in 1749, had the stone reset by court jeweler Andre Jacquemin, in a piece of ceremonial jewelry for the Order of the Golden Fleece (Toison D'Or). In 1791, after an attempt by Louis XVI and Marie Antoinette to flee France, the jewels of the French Royal Treasury were turned over to the government. During a week-long looting of the crown jewels in September of 1792, the French Blue diamond was stolen.

In 1812, a deep blue diamond described by John Francillion as weighing 177 grains (4 grains = 1 carat) was documented as being in the possession of London diamond merchant, Daniel Eliason. Strong evidence indicates that the stone was the recut French Blue and the same stone known today as the Hope Diamond. Several references suggest that it was acquired by King George IV of the United Kingdom. At his death, in 1830, the king's debts were so enormous that the blue diamond was likely sold through private channels.

The first reference to the diamond's next owner is found in the 1839 entry of the gem collection catalog of the well-known Henry Philip Hope, the man from whom the diamond takes its name. Unfortunately, the catalog does not reveal where or from whom Hope acquired the diamond or how much he paid for it.

Following the death of Henry Philip Hope in 1839, and after much litigation, the diamond passed to his nephew Henry Thomas Hope and ultimately to the nephew's grandson Lord Francis Hope. In 1901 Lord Francis Hope obtained permission from the Court of Chancery and his sisters to sell the stone to help pay off his debts. It was sold to a London dealer who quickly sold it to Joseph Frankels and Sons of New York City, who retained the stone in New York until they, in turn, needed cash. The diamond was next sold to Selim Habib who put it up for auction in Paris in 1909. It did not sell at the auction but was sold soon after to C.H. Rosenau and then resold to Pierre Cartier that same year.

In 1910 the Hope Diamond was shown to Mrs. Evalyn Walsh McLean, of Washington D.C., at Cartier's in Paris, but she did not like the setting. Cartier had the diamond reset and took it to the U.S. where he left it with Mrs. McLean for a weekend. This strategy was successful. The sale was made in 1911 with the diamond mounted as a headpiece on a three-tiered circlet of large white diamonds. Sometime later it became the pendant on a diamond necklace as we know it today. Mrs. McLean's flamboyant ownership of the stone lasted until her death in 1947.

Harry Winston Inc. of New York City purchased Mrs. McLean's entire jewelry collection, including the Hope Diamond, from her estate in 1949. This collection also included the 94.8-carat Star of the East diamond, the 15-carat Star of the South diamond, a 9-carat green diamond, and a 31-carat diamond which is now called the McLean diamond.

For the next 10 years the Hope Diamond was shown at many exhibits and charitable events world wide by Harry Winston Inc., including as the central attraction of their Court of Jewels exhibition. On November 10, 1958, they donated the Hope Diamond to the Smithsonian Institution, and almost immediately the great blue stone became its premier attraction.

The Hope Diamond has left the Smithsonian only four times since it was donated. In 1962, it was exhibited for a month at the Louvre in Paris, France, as part of an exhibit entitled Ten Centuries of French Jewelry. In 1965, the Hope Diamond traveled to South Africa where it was exhibited at the Rand Easter Show in Johannesburg. In 1984, the diamond was lent to Harry Winston Inc., in New York, as part of the firm's 50th anniversary celebration. In 1996, the Hope Diamond was again sent to Harry Winston Inc., in New York, this time for cleaning and some minor restoration work.

The weight of the Hope Diamond for many years was reported to be 44.5 carats. In 1974, it was removed from its setting and found actually to weigh 45.52 carats. It is classified as a type IIb diamond, which are semiconductive and usually phosphoresce. The Hope Diamond phosphoresces a strong red color, which will last for several seconds after exposure to short wave ultra-violet light. The diamond's blue coloration is attributed to trace amounts of boron in the stone.

In the pendant surrounding the Hope Diamond are 16 white diamonds, both pear-shapes and cushion cuts. A bail is soldered to the pendant where Mrs. McLean would often attach other diamonds including the McLean diamond and the Star of the East. The necklace chain contains 45 white diamonds.

In December of 1988, a team from the Gemological Institute of America visited the Smithsonian to grade the great blue stone using present day techniques. They observed that the gem shows evidence of wear, has a remarkably strong phosphorescence, and that its clarity is slightly affected by a whitish graining which is common to blue diamonds. They described the color as a fancy dark grayish-blue. An examination on the same day by another gemologist using a very sensitive colorimeter revealed that there is a very slight violet component to the deep blue color which is imperceptible to the naked eye. Still, one can only wonder that the original 112 3/16-carat stone bought by Tavernier was described as "un beau violet" (a beautiful violet).

---

### Photograph

### Hope Diamond Wrapper

### Hope Diamond

### Hope Diamond

### David L. Wolper and the Hope Diamond

### Queen Elizabeth Visits the Smithsonian

### Hope Diamond Presentation

### Hope Diamond Delivery

### Hope Diamond Presentation

### The Hope Diamond

### John White in the Gem Hall

### Inside the Smithsonian Channel Documentary about the Hope Diamond

### A Temporary Setting for a Timeless Gem

### The Extraordinary History of the Hope Diamond

### A Diamond's Fiery, Perilous Journey

### What Secrets Lie in The Hope Diamond?

### The Many Owners of the Hope Diamond

### Smithsonian's 150th Anniversary

### Drawings of diamonds from The six voyages of John Baptista Tavernier.

### How the Priceless Hope Diamond Traveled Through USPS

### Mystery of the Hope Diamond: Behind the Scenes

### The Hope Diamond's New Setting Revealed

### Historic Findings in the Smithsonian's Curators Reports

arrow-up Back to top

# Great Fire of London | Great Plague, Charles II, Firefighting | Britannica
URL: https://www.britannica.com/event/Great-Fire-of-London
Author: Britannica Editors

Great Fire of London | Great Plague, Charles II, Firefighting | Britannica

 Introduction References & Edit History Quick Facts & Related Topics 

Zoom in

 London residents escaping from the Great Fire of London in 1666 by way of the Thames. (more) 

# Great Fire of London

disaster, London, England, United Kingdom [1666]

 Britannica Editors

Great Fire of London, (September 2–5, 1666), the worst fire in London’s history. It destroyed a large part of the City of London, including most of the civic buildings, old St. Paul’s Cathedral, 87 parish churches, and about 13,000 houses.

On Sunday, September 2, 1666, the fire began accidentally in the house of the king’s baker in Pudding Lane near London Bridge. A violent east wind encouraged the flames, which raged during the whole of Monday and part of Tuesday. On Wednesday the fire slackened; on Thursday it was extinguished, but on the evening of that day the flames again burst forth at The Temple. Some houses were at once blown up by gunp
